import type { FeedEvent, QueueItem } from "../lib/connectors/types";
import type {
  ConnectorStatus,
  Container,
  DiskSample,
  ErrorEvent,
  Stream,
} from "../lib/connectors/types";
import { mulberry32, type DemoSnapshot } from "../lib/connectors/demo";
import type { ServerEvent } from "../lib/events/types";

export type QueueAction = "pause" | "resume" | "remove" | "retry";

const QUEUE_ACTIONS: readonly QueueAction[] = [
  "pause",
  "resume",
  "remove",
  "retry",
];

export function isQueueAction(value: unknown): value is QueueAction {
  return QUEUE_ACTIONS.includes(value as QueueAction);
}

/**
 * Initial frame set for a fresh connection.
 *
 * Only the last disk sample is sent: it already carries the accumulated
 * `history`, so the 24 earlier samples would be redundant frames.
 */
export function demoSnapshotEvents(snapshot: DemoSnapshot): ServerEvent[] {
  const events: ServerEvent[] = [
    { type: "queue.updated", items: snapshot.queue },
  ];

  for (const event of snapshot.feed) {
    events.push({ type: "feed.appended", event });
  }
  for (const stream of snapshot.streams) {
    events.push({ type: "stream.updated", stream });
  }
  const latestDisk = snapshot.diskHistory.at(-1);
  if (latestDisk) {
    events.push({ type: "disk.sample", sample: latestDisk });
  }
  for (const container of snapshot.containers) {
    events.push({ type: "container.state", container });
  }
  for (const error of snapshot.errors) {
    events.push({ type: "error.appended", error });
  }

  return events;
}

export interface DemoTicker {
  tick(): ServerEvent[];
}

const MAX_PROGRESS_UPDATES = 24;
const CONNECTORS: ConnectorStatus[] = ["up", "degraded", "down"];

function shuffledIds(ids: string[], rng: () => number): string[] {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const value = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = value;
  }
  return copy;
}

/**
 * Pure generator of demo traffic. Each tick derives its own PRNG from
 * `seed + tickIndex`, so two tickers with the same seed emit identical
 * sequences regardless of how the caller spaces the ticks.
 */
export function createDemoTicker(
  snapshot: DemoSnapshot,
  options: { seed?: number } = {},
): DemoTicker {
  const seed = options.seed ?? 0x1f2e3d4c;
  const downloading = snapshot.queue.filter(
    (item) => item.status === "downloading",
  );
  const progress = new Map(downloading.map((item) => [item.id, item.progress]));
  const connectorIds = Array.from(
    new Set(snapshot.queue.map((item) => item.service)),
  );
  let tickIndex = 0;

  return {
    tick() {
      const rng = mulberry32((seed + tickIndex * 0x9e3779b9) >>> 0);
      tickIndex += 1;
      const events: ServerEvent[] = [];

      if (downloading.length > 0) {
        const ids = shuffledIds(
          downloading.map((item) => item.id),
          rng,
        ).slice(0, Math.min(MAX_PROGRESS_UPDATES, downloading.length));

        for (const id of ids) {
          const current = progress.get(id) ?? 0;
          const next = Math.min(0.99, current + 0.001 + rng() * 0.004);
          progress.set(id, next);
          events.push({ type: "item.progress", id, progress: next });
        }
      }

      if (snapshot.streams.length > 0 && tickIndex % 3 === 0) {
        const stream =
          snapshot.streams[Math.floor(rng() * snapshot.streams.length)]!;
        events.push({
          type: "stream.updated",
          stream: {
            ...stream,
            cpuPercent: Math.min(
              100,
              Math.max(0, Math.round(stream.cpuPercent + rng() * 8 - 4)),
            ),
          },
        });
      }

      if (connectorIds.length > 0 && tickIndex % 7 === 0) {
        const id =
          connectorIds[Math.floor(rng() * connectorIds.length)]!;
        events.push({
          type: "connector.status",
          id,
          status: CONNECTORS[Math.floor(rng() * CONNECTORS.length)]!,
        });
      }

      return events;
    },
  };
}

/**
 * Mutates only the passed map.
 *
 * - `pause` keeps the current progress frozen.
 * - `resume` returns the item to `downloading` with progress untouched.
 * - `retry` restarts the download at progress 0.
 * - `remove` deletes the entry.
 */
export function applyAction(
  items: Map<string, QueueItem>,
  id: string,
  action: string,
): { ok: boolean; reason?: string } {
  const item = items.get(id);
  if (!item) return { ok: false, reason: "unknown item" };

  switch (action) {
    case "pause":
      items.set(id, { ...item, status: "paused" });
      return { ok: true };
    case "resume":
      items.set(id, { ...item, status: "downloading" });
      return { ok: true };
    case "retry":
      items.set(id, { ...item, status: "downloading", progress: 0 });
      return { ok: true };
    case "remove":
      items.delete(id);
      return { ok: true };
    default:
      return { ok: false, reason: "unknown action" };
  }
}

/** 1 s, 2 s, 4 s, 8 s, then a 30 s cap for per-service supervision. */
export function backoffDelay(attempt: number): number {
  const delays = [1000, 2000, 4000, 8000];
  return delays[attempt - 1] ?? 30000;
}

export type { Container, DiskSample, ErrorEvent, FeedEvent, Stream };
