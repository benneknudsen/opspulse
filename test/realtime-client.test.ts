import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QueueItem } from "@/lib/connectors/types";
import { createSocketClient, type SocketLike } from "@/lib/realtime/client";
import { useConnectionStore } from "@/lib/store/connection";
import { useFeedStore } from "@/lib/store/feed";
import { useQueueStore } from "@/lib/store/queue";

type Listener = ((event: unknown) => void) | null;

class FakeSocket {
  static instances: FakeSocket[] = [];

  onopen: Listener = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: Listener = null;
  onerror: Listener = null;
  closed = false;

  constructor() {
    FakeSocket.instances.push(this);
  }

  open(): void {
    this.onopen?.({});
  }

  message(data: unknown): void {
    this.onmessage?.({ data });
  }

  drop(): void {
    this.onclose?.({});
  }

  close(): void {
    this.closed = true;
  }
}

const item: QueueItem = {
  id: "item-1",
  service: "radarr",
  title: "Dune: Part Two",
  sub: "2024",
  quality: "Bluray-1080p",
  progress: 0.2,
  eta: "12 min",
  status: "downloading",
};

function latest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("no socket created");
  return socket;
}

describe("socket client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    useConnectionStore.setState({
      status: "live",
      lastSync: null,
      attempt: 0,
      actionsEnabled: true,
    });
    useQueueStore.getState().reset();
    useFeedStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports connecting, not live, until the socket opens", () => {
    useConnectionStore.setState(useConnectionStore.getInitialState());
    const client = createSocketClient({
      url: "ws://test",
      socketFactory: () => new FakeSocket() as unknown as SocketLike,
    });
    client.start();

    expect(useConnectionStore.getState().status).toBe("connecting");
    expect(useConnectionStore.getState().actionsEnabled).toBe(false);

    latest().open();
    expect(useConnectionStore.getState().status).toBe("live");
    client.dispose();
  });

  it("goes live on open and applies progress frames", () => {
    useQueueStore.getState().applyItems([item]);
    const client = createSocketClient({
      url: "ws://test",
      socketFactory: () => new FakeSocket() as unknown as SocketLike,
    });
    client.start();
    expect(FakeSocket.instances).toHaveLength(1);

    latest().open();
    expect(useConnectionStore.getState().status).toBe("live");

    latest().message(
      JSON.stringify({ type: "item.progress", id: "item-1", progress: 0.8 }),
    );

    expect(useQueueStore.getState().items["item-1"]?.progress).toBe(0.8);
    expect(useConnectionStore.getState().lastSync).not.toBeNull();
    client.dispose();
    expect(latest().closed).toBe(true);
  });

  it("retries on the 1/2/4/8/15 second schedule and then reports lost", () => {
    const client = createSocketClient({
      url: "ws://test",
      socketFactory: () => new FakeSocket() as unknown as SocketLike,
    });
    client.start();
    latest().open();

    const schedule = [1000, 2000, 4000, 8000];
    for (let attempt = 1; attempt <= schedule.length; attempt += 1) {
      latest().drop();
      expect(useConnectionStore.getState().status).toBe("reconnecting");
      expect(FakeSocket.instances).toHaveLength(attempt);

      vi.advanceTimersByTime(schedule[attempt - 1]! - 1);
      expect(FakeSocket.instances).toHaveLength(attempt);

      vi.advanceTimersByTime(1);
      expect(FakeSocket.instances).toHaveLength(attempt + 1);
    }

    latest().drop();
    expect(useConnectionStore.getState().status).toBe("lost");
    expect(FakeSocket.instances).toHaveLength(5);

    vi.advanceTimersByTime(15_000);
    expect(FakeSocket.instances).toHaveLength(6);

    latest().drop();
    expect(useConnectionStore.getState().status).toBe("lost");
    vi.advanceTimersByTime(15_000);
    expect(FakeSocket.instances).toHaveLength(7);

    latest().open();
    expect(useConnectionStore.getState().status).toBe("live");
    expect(useConnectionStore.getState().attempt).toBe(0);
    client.dispose();
  });

  it("ignores an unparseable frame without throwing", () => {
    const client = createSocketClient({
      url: "ws://test",
      socketFactory: () => new FakeSocket() as unknown as SocketLike,
    });
    client.start();
    latest().open();

    expect(() => latest().message("{not json")).not.toThrow();
    expect(useConnectionStore.getState().status).toBe("live");
    client.dispose();
  });

  it("clears every pending timer on dispose", () => {
    const client = createSocketClient({
      url: "ws://test",
      socketFactory: () => new FakeSocket() as unknown as SocketLike,
    });
    client.start();
    latest().open();
    latest().drop();
    expect(vi.getTimerCount()).toBe(1);

    client.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
