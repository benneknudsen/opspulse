import { describe, expect, it } from "vitest";

import { createDemoSnapshot } from "@/lib/connectors/demo";
import type { QueueItem } from "@/lib/connectors/types";
import {
  applyAction,
  backoffDelay,
  createDemoTicker,
  demoSnapshotEvents,
} from "@/server/simulate";

const item: QueueItem = {
  id: "demo-00001",
  service: "radarr",
  title: "Dune: Part Two",
  sub: "2024",
  quality: "Bluray-1080p",
  progress: 0.5,
  eta: "12 min",
  status: "downloading",
};

describe("demoSnapshotEvents", () => {
  it("emits one initial frame per dataset", () => {
    const snapshot = createDemoSnapshot();
    const events = demoSnapshotEvents(snapshot);

    expect(events.filter((event) => event.type === "queue.updated")).toHaveLength(1);
    expect(events.filter((event) => event.type === "feed.appended")).toHaveLength(
      snapshot.feed.length,
    );
    expect(events.filter((event) => event.type === "stream.updated")).toHaveLength(
      snapshot.streams.length,
    );
    expect(events.filter((event) => event.type === "disk.sample")).toHaveLength(1);
    expect(
      events.filter((event) => event.type === "container.state"),
    ).toHaveLength(snapshot.containers.length);
    expect(events.filter((event) => event.type === "error.appended")).toHaveLength(
      snapshot.errors.length,
    );

    const queueFrame = events[0];
    expect(queueFrame?.type).toBe("queue.updated");
    if (queueFrame?.type === "queue.updated") {
      expect(queueFrame.items).toHaveLength(snapshot.queue.length);
    }
  });
});

describe("createDemoTicker", () => {
  it("produces identical sequences for the same seed", () => {
    const snapshot = createDemoSnapshot();
    const left = createDemoTicker(snapshot, { seed: 42 });
    const right = createDemoTicker(snapshot, { seed: 42 });

    for (let tick = 0; tick < 25; tick += 1) {
      expect(left.tick()).toEqual(right.tick());
    }
  });

  it("emits a bounded subset of downloading items per tick", () => {
    const snapshot = createDemoSnapshot();
    const ticker = createDemoTicker(snapshot, { seed: 7 });
    const events = ticker.tick();
    const progress = events.filter((event) => event.type === "item.progress");

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.length).toBeLessThanOrEqual(40);
  });
});

describe("backoffDelay", () => {
  it("follows 1/2/4/8/30 seconds and caps at 30", () => {
    expect([1, 2, 3, 4, 5, 9, 100].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 30000, 30000, 30000,
    ]);
  });
});

describe("applyAction", () => {
  it("mutates only the passed map", () => {
    const items = new Map([[item.id, { ...item }]]);

    expect(applyAction(items, item.id, "pause")).toEqual({ ok: true });
    expect(items.get(item.id)?.status).toBe("paused");
    expect(items.get(item.id)?.progress).toBe(0.5);

    expect(applyAction(items, item.id, "resume")).toEqual({ ok: true });
    expect(items.get(item.id)?.status).toBe("downloading");

    expect(applyAction(items, item.id, "retry")).toEqual({ ok: true });
    expect(items.get(item.id)?.status).toBe("downloading");
    expect(items.get(item.id)?.progress).toBe(0);
  });

  it("removes an item", () => {
    const items = new Map([[item.id, { ...item }]]);
    expect(applyAction(items, item.id, "remove")).toEqual({ ok: true });
    expect(items.has(item.id)).toBe(false);
  });

  it("reports unknown ids and actions", () => {
    const items = new Map([[item.id, { ...item }]]);
    expect(applyAction(items, "missing", "pause").ok).toBe(false);
    expect(applyAction(items, item.id, "explode").ok).toBe(false);
    expect(applyAction(items, "missing", "pause").reason).toBeTruthy();
  });
});
