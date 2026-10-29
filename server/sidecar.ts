import { WebSocketServer, WebSocket } from "ws";

import { loadConfig } from "../lib/config/load";
import {
  createDemoSnapshot,
  DEMO_SEED,
  type DemoSnapshot,
} from "../lib/connectors/demo";
import { createConnector } from "../lib/connectors/registry";
import type {
  Connector,
  ConnectorStatus,
  Container,
  DiskSample,
  ErrorEvent,
  QueueItem,
  Stream,
} from "../lib/connectors/types";
import type { ServerEvent } from "../lib/events/types";
import {
  applyAction,
  backoffDelay,
  createDemoTicker,
  demoSnapshotEvents,
  isQueueAction,
  type QueueAction,
} from "./simulate";

export type SidecarMode = "demo" | "live";

export interface SidecarLogger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface StartWsServerOptions {
  port?: number;
  host?: string;
  tickMs?: number;
  mode?: SidecarMode;
  snapshot?: DemoSnapshot;
  log?: SidecarLogger;
}

export interface RunningWsServer {
  port: number;
  tickMs: number;
  close(): Promise<void>;
}

interface ServiceRuntime {
  id: string;
  connector: Connector;
  status: ConnectorStatus;
  attempt: number;
  nextAt: number;
}

interface LiveState {
  streams: Map<string, Stream>;
  containers: Map<string, Container>;
  disk: DiskSample | null;
  errors: ErrorEvent[];
}

function resolvePort(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(process.env.OPSPULSE_WS_PORT ?? 8787);
  return Number.isFinite(parsed) ? parsed : 8787;
}

function resolveTickMs(mode: SidecarMode, value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(process.env.OPSPULSE_TICK_MS);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return mode === "demo" ? 1000 : 5000;
}

function liveInitialEvents(
  items: Map<string, QueueItem>,
  services: ServiceRuntime[],
  state: LiveState,
): ServerEvent[] {
  const events: ServerEvent[] = [];

  if (items.size > 0) {
    events.push({ type: "queue.updated", items: [...items.values()] });
  }
  for (const runtime of services) {
    events.push({
      type: "connector.status",
      id: runtime.id,
      status: runtime.status,
    });
  }
  for (const stream of state.streams.values()) {
    events.push({ type: "stream.updated", stream });
  }
  if (state.disk) events.push({ type: "disk.sample", sample: state.disk });
  for (const container of state.containers.values()) {
    events.push({ type: "container.state", container });
  }
  for (const error of state.errors) {
    events.push({ type: "error.appended", error });
  }

  return events;
}

export async function startWsServer(
  options: StartWsServerOptions = {},
): Promise<RunningWsServer> {
  const log = options.log ?? console;
  const host = options.host ?? process.env.OPSPULSE_WS_HOST ?? "127.0.0.1";
  let mode: SidecarMode = options.mode ?? "demo";
  const port = resolvePort(options.port);

  const snapshot: DemoSnapshot = options.snapshot ?? createDemoSnapshot();
  const liveState: LiveState = {
    streams: new Map(),
    containers: new Map(),
    disk: null,
    errors: [],
  };
  let services: ServiceRuntime[] = [];
  let demoTicker: ReturnType<typeof createDemoTicker> | null = null;

  if (mode === "live") {
    try {
      const config = loadConfig();
      services = config.services.map((service) => ({
        id: service.id,
        connector: createConnector(service),
        status: "unknown" as ConnectorStatus,
        attempt: 0,
        nextAt: 0,
      }));
    } catch {
      // Missing or invalid config must not stop the sidecar: demo traffic is
      // still useful locally.
      log.log("ws: no usable config, falling back to demo mode");
      mode = "demo";
    }
  }

  // Resolved after the live->demo fallback so a fallback uses the demo cadence.
  const tickMs = resolveTickMs(mode, options.tickMs);

  // The demo snapshot is demo-mode only. A live server starts empty and fills
  // its queue solely from connector reports.
  const items = new Map<string, QueueItem>(
    mode === "demo" ? snapshot.queue.map((item) => [item.id, { ...item }]) : [],
  );

  if (mode === "demo") {
    demoTicker = createDemoTicker(snapshot, { seed: DEMO_SEED });
  }

  function initialEvents(): ServerEvent[] {
    // `queue.updated` is upsert/merge semantics: the first frame carries the
    // full set, and action replies carry only the changed item(s).
    if (mode === "demo") {
      return demoSnapshotEvents({ ...snapshot, queue: [...items.values()] });
    }
    return liveInitialEvents(items, services, liveState);
  }

  const wss = new WebSocketServer({ host, port });

  // Persistent server-level handler: a receiver/protocol error must never
  // become an unhandled "error" event after the server is up.
  wss.on("error", (error) => {
    log.error(
      "ws: server error",
      error instanceof Error ? error.message : error,
    );
  });

  await new Promise<void>((resolve, reject) => {
    const onListening = () => {
      wss.off("error", onError);
      resolve();
    };
    // One-shot reject for the startup await only; the persistent handler above
    // stays attached for the lifetime of the server.
    const onError = (error: Error) => {
      wss.off("listening", onListening);
      reject(error);
    };
    wss.once("listening", onListening);
    wss.once("error", onError);
  });

  const address = wss.address();
  const boundPort =
    typeof address === "object" && address !== null ? address.port : port;

  let garbageLogged = false;

  function broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  function reply(client: WebSocket, event: ServerEvent): void {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
  }

  function handleMessage(client: WebSocket, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (!garbageLogged) {
        garbageLogged = true;
        log.log("ws: ignoring malformed frame");
      }
      reply(client, {
        type: "action.result",
        id: "",
        ok: false,
        reason: "malformed frame",
      });
      return;
    }

    if (!parsed || typeof parsed !== "object") return;

    const message = parsed as {
      type?: unknown;
      id?: unknown;
      action?: unknown;
    };

    if (message.type !== "action") {
      if (!garbageLogged) {
        garbageLogged = true;
        log.log("ws: ignoring unsupported frame");
      }
      return;
    }

    const id = typeof message.id === "string" ? message.id : "";
    const action: QueueAction | null = isQueueAction(message.action)
      ? message.action
      : null;

    if (!action) {
      reply(client, {
        type: "action.result",
        id,
        ok: false,
        reason: "unknown action",
      });
      return;
    }

    const result = applyAction(items, id, action);
    reply(client, {
      type: "action.result",
      id,
      ok: result.ok,
      ...(result.reason === undefined ? {} : { reason: result.reason }),
    });

    if (!result.ok) return;

    // `remove` deletes the row but has no wire signal: the frozen ServerEvent
    // union has no removal event (adding one would break test/events.test.ts),
    // and the client cannot send actions yet because SocketLike has no `send`.
    // Both belong to the optimistic-actions issue (#18).
    const changed = items.get(id);
    if (!changed) return;
    broadcast({ type: "queue.updated", items: [changed] });
  }

  wss.on("connection", (client) => {
    // Receiver errors (invalid UTF-8, oversized payload, bad masking, binary
    // junk) arrive here through `emit("error")`. Log once, then drop only this
    // client; the server and its other clients keep running.
    let clientErrorLogged = false;
    client.on("error", (error) => {
      if (clientErrorLogged) return;
      clientErrorLogged = true;
      log.error(
        "ws: client error",
        error instanceof Error ? error.message : error,
      );
      client.terminate();
    });

    for (const event of initialEvents()) reply(client, event);

    client.on("message", (raw) => {
      handleMessage(client, raw.toString());
    });
  });

  async function pollService(runtime: ServiceRuntime): Promise<void> {
    const status = await runtime.connector.healthCheck();
    runtime.status = status;

    if (status === "up") {
      runtime.attempt = 0;
      runtime.nextAt = 0;
    } else {
      runtime.attempt += 1;
      runtime.nextAt = Date.now() + backoffDelay(runtime.attempt);
    }

    broadcast({ type: "connector.status", id: runtime.id, status });
    if (status !== "up") return;

    const connector = runtime.connector;

    if (connector.queue) {
      const queue = await connector.queue();
      if (queue.length > 0) {
        for (const item of queue) items.set(item.id, item);
        broadcast({ type: "queue.updated", items: queue });
      }
    }
    if (connector.streams) {
      for (const stream of await connector.streams()) {
        liveState.streams.set(stream.id, stream);
        broadcast({ type: "stream.updated", stream });
      }
    }
    if (connector.disk) {
      const disk = await connector.disk();
      if (disk) {
        liveState.disk = disk;
        broadcast({ type: "disk.sample", sample: disk });
      }
    }
    if (connector.containers) {
      for (const container of await connector.containers()) {
        liveState.containers.set(container.name, container);
        broadcast({ type: "container.state", container });
      }
    }
    if (connector.errors) {
      for (const error of await connector.errors()) {
        liveState.errors.push(error);
        broadcast({ type: "error.appended", error });
      }
    }
  }

  async function pollLive(): Promise<void> {
    const now = Date.now();
    for (const runtime of services) {
      if (now < runtime.nextAt) continue;
      try {
        await pollService(runtime);
      } catch {
        runtime.attempt += 1;
        runtime.status = "down";
        runtime.nextAt = Date.now() + backoffDelay(runtime.attempt);
        broadcast({ type: "connector.status", id: runtime.id, status: "down" });
      }
    }
  }

  let tickInFlight = false;
  const interval = setInterval(() => {
    if (tickInFlight) return;
    tickInFlight = true;

    void (async () => {
      try {
        if (mode === "demo" && demoTicker) {
          for (const event of demoTicker.tick()) {
            if (event.type === "item.progress") {
              const item = items.get(event.id);
              if (item) {
                items.set(event.id, { ...item, progress: event.progress });
              }
            }
            broadcast(event);
          }
          return;
        }
        await pollLive();
      } catch (error) {
        log.error(
          "ws: tick failed",
          error instanceof Error ? error.message : error,
        );
      } finally {
        tickInFlight = false;
      }
    })();
  }, tickMs);

  return {
    port: boundPort,
    tickMs,
    async close() {
      clearInterval(interval);
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}

export async function main(): Promise<void> {
  const mode: SidecarMode =
    process.env.OPSPULSE_MODE === "live" ? "live" : "demo";
  const host = process.env.OPSPULSE_WS_HOST ?? "127.0.0.1";

  try {
    const server = await startWsServer({ mode });
    console.log(`ws listening on ws://${host}:${server.port} (${mode})`);

    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await server.close();
      process.exit(0);
    };

    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  } catch (error) {
    console.error(
      "ws: failed to start",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
}
