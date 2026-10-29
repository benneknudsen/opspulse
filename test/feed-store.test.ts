import { beforeEach, describe, expect, it } from "vitest";

import type { FeedEvent } from "@/lib/connectors/types";
import {
  FEED_CAP,
  FEED_INITIAL_VISIBLE,
  FEED_PAGE,
  useFeedStore,
} from "@/lib/store/feed";

function makeEvent(index: number, at?: string): FeedEvent {
  return {
    id: `feed-${index}`,
    service: "radarr",
    title: `Title ${index}`,
    sub: "Download finished",
    severity: "ok",
    at: at ?? new Date(2026, 0, 1, 0, index).toISOString(),
    poster: "",
  };
}

describe("feed store", () => {
  beforeEach(() => {
    useFeedStore.getState().reset();
  });

  it("prepends newest events and keeps untouched entries identical", () => {
    useFeedStore.getState().append(makeEvent(1));
    const first = useFeedStore.getState().events[0];

    useFeedStore.getState().append(makeEvent(2));

    const { events } = useFeedStore.getState();
    expect(events.map((event) => event.id)).toEqual(["feed-2", "feed-1"]);
    expect(events[1]).toBe(first);
    expect(useFeedStore.getState().visibleCount).toBe(FEED_INITIAL_VISIBLE);
  });

  it("ignores an event whose id is already present", () => {
    useFeedStore.getState().append(makeEvent(1));
    const first = useFeedStore.getState().events[0];

    useFeedStore.getState().append({ ...makeEvent(1), title: "changed" });

    expect(useFeedStore.getState().events).toHaveLength(1);
    expect(useFeedStore.getState().events[0]).toBe(first);
  });

  it("drops the oldest entries beyond the cap", () => {
    for (let index = 0; index < FEED_CAP + 5; index += 1) {
      useFeedStore.getState().append(makeEvent(index));
    }

    const { events } = useFeedStore.getState();
    expect(events).toHaveLength(FEED_CAP);
    expect(events[0]?.id).toBe(`feed-${FEED_CAP + 4}`);
    expect(events.at(-1)?.id).toBe("feed-5");
  });

  it("shows more in pages of six, capped at the event count", () => {
    useFeedStore.getState().append(makeEvent(1));
    useFeedStore.getState().append(makeEvent(2));

    useFeedStore.getState().showMore();
    expect(useFeedStore.getState().visibleCount).toBe(2);

    useFeedStore.getState().reset();
    for (let index = 0; index < 20; index += 1) {
      useFeedStore.getState().append(makeEvent(index));
    }

    useFeedStore.getState().showMore();
    expect(useFeedStore.getState().visibleCount).toBe(
      FEED_INITIAL_VISIBLE + FEED_PAGE,
    );

    for (let page = 0; page < 10; page += 1) {
      useFeedStore.getState().showMore();
    }
    expect(useFeedStore.getState().visibleCount).toBe(20);
  });

  it("does not reorder events that share a timestamp", () => {
    const at = "2026-01-01T00:00:00.000Z";
    useFeedStore.getState().append(makeEvent(1, at));
    const first = useFeedStore.getState().events[0];
    useFeedStore.getState().append(makeEvent(2, at));

    const { events } = useFeedStore.getState();
    expect(events.map((event) => event.id)).toEqual(["feed-2", "feed-1"]);
    expect(events[1]).toBe(first);
  });

  it("reset restores the initial state", () => {
    useFeedStore.getState().append(makeEvent(1));
    useFeedStore.getState().showMore();
    useFeedStore.getState().reset();

    expect(useFeedStore.getState().events).toEqual([]);
    expect(useFeedStore.getState().visibleCount).toBe(FEED_INITIAL_VISIBLE);
  });
});
