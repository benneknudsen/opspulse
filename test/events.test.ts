import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/lib/connectors/types";
import type { ServerEvent } from "@/lib/events/types";

const queueItem: QueueItem = {
  id: "demo-00001",
  service: "radarr",
  title: "Dune: Part Two",
  sub: "2024",
  quality: "Bluray-1080p",
  progress: 0.6,
  eta: "12 min",
  status: "downloading",
};

describe("server event union", () => {
  it("covers all nine event types with typed payloads", () => {
    const events: ServerEvent[] = [
      { type: "queue.updated", items: [queueItem] },
      { type: "item.progress", id: "demo-00001", progress: 0.61 },
      {
        type: "feed.appended",
        event: {
          id: "feed-1",
          service: "radarr",
          title: "Dune: Part Two",
          sub: "Download finished",
          severity: "ok",
          at: "2026-10-22T12:00:00.000Z",
          poster: "data:image/svg+xml;base64,PHN2Zy8+",
        },
      },
      {
        type: "stream.updated",
        stream: {
          id: "stream-1",
          user: "benne",
          device: "Apple TV 4K",
          title: "Dune: Part Two",
          poster: "data:image/svg+xml;base64,PHN2Zy8+",
          bitrate: 18_400,
          mode: "direct",
          cpuPercent: 0,
          startedAt: "2026-10-22T11:18:00.000Z",
        },
      },
      {
        type: "disk.sample",
        sample: {
          device: "Media",
          tempC: 44,
          minC: 39,
          maxC: 48,
          smart: "ok",
          uptime: "27d 4h",
          history: [44],
          at: "2026-10-22T12:00:00.000Z",
        },
      },
      {
        type: "container.state",
        container: { name: "radarr", state: "up", uptime: "Up 14d 6h" },
      },
      {
        type: "error.appended",
        error: {
          severity: "warning",
          service: "scrutiny",
          message: "SMART attribute 5 reallocated sectors",
          at: "2026-10-22T11:14:00.000Z",
        },
      },
      { type: "connector.status", id: "radarr", status: "up" },
      { type: "action.result", id: "demo-00001", ok: false, reason: "denied" },
    ];

    expect(events).toHaveLength(9);
    expect(new Set(events.map((event) => event.type))).toEqual(
      new Set([
        "queue.updated",
        "item.progress",
        "feed.appended",
        "stream.updated",
        "disk.sample",
        "container.state",
        "error.appended",
        "connector.status",
        "action.result",
      ]),
    );
  });
});
