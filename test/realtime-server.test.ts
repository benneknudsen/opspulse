// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import type { DemoSnapshot } from "@/lib/connectors/demo";
import type { QueueItem } from "@/lib/connectors/types";
import type { ServerEvent } from "@/lib/events/types";
import { startWsServer } from "@/server/sidecar";

const item: QueueItem = {
  id: "tiny-1",
  service: "radarr",
  title: "Dune: Part Two",
  sub: "2024",
  quality: "Bluray-1080p",
  progress: 0.2,
  eta: "12 min",
  status: "downloading",
};

const snapshot: DemoSnapshot = {
  queue: [item],
  feed: [],
  streams: [],
  containers: [],
  diskHistory: [],
  errors: [],
};

async function collect(socket: WebSocket) {
  const events: ServerEvent[] = [];
  const waiters: Array<() => void> = [];

  socket.on("message", (raw) => {
    events.push(JSON.parse(raw.toString()) as ServerEvent);
    for (const waiter of waiters.splice(0)) waiter();
  });

  function waitFor<T extends ServerEvent>(
    predicate: (event: ServerEvent) => event is T,
    timeout = 2000,
  ): Promise<T> {
    const existing = events.find(predicate);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timed out waiting for event"));
      }, timeout);
      const check = () => {
        const found = events.find(predicate);
        if (!found) {
          waiters.push(check);
          return;
        }
        clearTimeout(timer);
        resolve(found as T);
      };
      waiters.push(check);
    });
  }

  /**
   * Only scans frames received at or after `fromIndex`, so a frame buffered
   * before the trigger cannot satisfy the wait.
   */
  function waitForAfter<T extends ServerEvent>(
    predicate: (event: ServerEvent) => event is T,
    fromIndex: number,
    timeout = 2000,
  ): Promise<T> {
    const find = (): T | undefined => {
      for (let index = fromIndex; index < events.length; index += 1) {
        const event = events[index]!;
        if (predicate(event)) return event;
      }
      return undefined;
    };

    const existing = find();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timed out waiting for a new event"));
      }, timeout);
      const check = () => {
        const found = find();
        if (!found) {
          waiters.push(check);
          return;
        }
        clearTimeout(timer);
        resolve(found);
      };
      waiters.push(check);
    });
  }

  return { events, waitFor, waitForAfter };
}

const servers: Array<{ close: () => Promise<void> }> = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const server of servers.splice(0)) await server.close();
});

describe("ws sidecar", () => {
  it("serves the initial frame set, ticks, actions and survives garbage", async () => {
    const server = await startWsServer({
      port: 0,
      tickMs: 25,
      mode: "demo",
      snapshot,
      log: { log: () => {}, error: () => {} },
    });
    servers.push(server);
    expect(server.port).toBeGreaterThan(0);

    const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
    sockets.push(socket);
    const { events, waitFor, waitForAfter } = await collect(socket);

    const first = await waitFor(
      (event): event is Extract<ServerEvent, { type: "queue.updated" }> =>
        event.type === "queue.updated",
    );
    expect(first.items).toEqual([item]);

    const progress = await waitFor(
      (event): event is Extract<ServerEvent, { type: "item.progress" }> =>
        event.type === "item.progress",
    );
    expect(progress.id).toBe("tiny-1");

    socket.send(
      JSON.stringify({ type: "action", id: "tiny-1", action: "pause" }),
    );

    const result = await waitFor(
      (event): event is Extract<ServerEvent, { type: "action.result" }> =>
        event.type === "action.result" && event.id === "tiny-1",
    );
    expect(result).toMatchObject({ ok: true });

    const delta = await waitFor(
      (event): event is Extract<ServerEvent, { type: "queue.updated" }> =>
        event.type === "queue.updated" &&
        event.items.length === 1 &&
        event.items[0]?.status === "paused",
    );
    expect(delta.items).toHaveLength(1);
    expect(delta.items[0]).toMatchObject({ id: "tiny-1", status: "paused" });

    socket.send(
      JSON.stringify({ type: "action", id: "missing", action: "pause" }),
    );
    const failed = await waitFor(
      (event): event is Extract<ServerEvent, { type: "action.result" }> =>
        event.type === "action.result" && event.id === "missing",
    );
    expect(failed.ok).toBe(false);
    expect(failed.reason).toBeTruthy();

    const beforeAppGarbage = events.length;
    socket.send("this is not json");
    const afterAppGarbage = await waitForAfter(
      (event): event is Extract<ServerEvent, { type: "item.progress" }> =>
        event.type === "item.progress",
      beforeAppGarbage,
    );
    expect(afterAppGarbage.type).toBe("item.progress");

    // A protocol-level malformed frame (unmasked client frame) makes ws emit
    // `error` on the offending socket. It must not kill the server.
    const attacker = new WebSocket(`ws://127.0.0.1:${server.port}`);
    sockets.push(attacker);
    attacker.on("error", () => {});
    await new Promise<void>((resolve, reject) => {
      attacker.once("open", () => resolve());
      attacker.once("error", reject);
    });

    const beforeProtocolGarbage = events.length;
    const rawSocket = (
      attacker as unknown as { _socket: { write: (chunk: Buffer) => void } }
    )._socket;
    rawSocket.write(Buffer.from([0x81, 0x01, 0x00]));

    const afterProtocolGarbage = await waitForAfter(
      (event): event is Extract<ServerEvent, { type: "item.progress" }> =>
        event.type === "item.progress",
      beforeProtocolGarbage,
    );
    expect(afterProtocolGarbage.type).toBe("item.progress");

    // A malformed frame must not prevent a brand-new connection from being
    // served the initial frame set.
    const second = new WebSocket(`ws://127.0.0.1:${server.port}`);
    sockets.push(second);
    const { waitFor: waitSecond } = await collect(second);
    const secondInitial = await waitSecond(
      (event): event is Extract<ServerEvent, { type: "queue.updated" }> =>
        event.type === "queue.updated",
    );
    expect(secondInitial.items.map((entry) => entry.id)).toEqual([item.id]);
  });

  it("starts live mode empty and only reports connector data", async () => {
    const directory = mkdtempSync(join(tmpdir(), "opspulse-live-"));
    const configPath = join(directory, "config.yaml");
    writeFileSync(
      configPath,
      "services:\n  - id: custom-1\n    type: custom\n    url: http://127.0.0.1:9\n",
    );

    const previousConfig = process.env.OPSPULSE_CONFIG;
    process.env.OPSPULSE_CONFIG = configPath;

    try {
      const server = await startWsServer({
        port: 0,
        tickMs: 10,
        mode: "live",
        snapshot,
        log: { log: () => {}, error: () => {} },
      });
      servers.push(server);
      expect(server.tickMs).toBe(10);

      const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
      sockets.push(socket);
      const { events, waitFor } = await collect(socket);

      const status = await waitFor(
        (event): event is Extract<ServerEvent, { type: "connector.status" }> =>
          event.type === "connector.status",
      );
      expect(status.id).toBe("custom-1");

      await new Promise((resolve) => setTimeout(resolve, 50));
      const queueEvents = events.filter(
        (event) => event.type === "queue.updated",
      );
      expect(queueEvents).toHaveLength(0);
    } finally {
      if (previousConfig === undefined) delete process.env.OPSPULSE_CONFIG;
      else process.env.OPSPULSE_CONFIG = previousConfig;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the demo cadence after a live fallback", async () => {
    const previousConfig = process.env.OPSPULSE_CONFIG;
    const previousTick = process.env.OPSPULSE_TICK_MS;
    process.env.OPSPULSE_CONFIG = join(
      tmpdir(),
      "opspulse-missing-config.yaml",
    );
    delete process.env.OPSPULSE_TICK_MS;

    try {
      const server = await startWsServer({
        port: 0,
        mode: "live",
        log: { log: () => {}, error: () => {} },
      });
      servers.push(server);
      expect(server.tickMs).toBe(1000);
    } finally {
      if (previousConfig === undefined) delete process.env.OPSPULSE_CONFIG;
      else process.env.OPSPULSE_CONFIG = previousConfig;
      if (previousTick === undefined) delete process.env.OPSPULSE_TICK_MS;
      else process.env.OPSPULSE_TICK_MS = previousTick;
    }
  });

  it("close frees the port", async () => {
    const server = await startWsServer({
      port: 0,
      tickMs: 50,
      mode: "demo",
      snapshot,
      log: { log: () => {}, error: () => {} },
    });
    const { port } = server;
    await server.close();

    await new Promise<void>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
    });
  });
});
