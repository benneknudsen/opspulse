import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueueItem } from "@/lib/connectors/types";
import type { ServerEvent } from "@/lib/events/types";
import { applyServerEvent } from "@/lib/realtime/apply";
import {
  useQueueItem,
  useQueueStore,
} from "@/lib/store/queue";

function makeItem(index: number): QueueItem {
  return {
    id: `item-${index}`,
    service: index % 2 === 0 ? "radarr" : "sonarr",
    title: `Title ${index}`,
    sub: String(2000 + index),
    quality: "Bluray-1080p",
    progress: 0.1,
    eta: "10 min",
    status: "downloading",
  };
}

const renders = new Map<string, number>();

function RowProbe({ id }: { id: string }) {
  const item = useQueueItem(id);
  renders.set(id, (renders.get(id) ?? 0) + 1);
  return <span>{item?.progress}</span>;
}

describe("queue store", () => {
  beforeEach(() => {
    useQueueStore.getState().reset();
    renders.clear();
  });

  it("keeps strict identity for untouched rows across 1,000 progress events", () => {
    const seed = Array.from({ length: 1_000 }, (_, index) => makeItem(index));
    useQueueStore.getState().applyItems(seed);
    const references = seed.map(
      (item) => useQueueStore.getState().items[item.id],
    );

    for (let tick = 0; tick < 1_000; tick += 1) {
      const event: ServerEvent = {
        type: "item.progress",
        id: "item-500",
        progress: (tick % 90) / 100,
      };
      applyServerEvent(event);
    }

    references.forEach((reference, index) => {
      const id = `item-${index}`;
      if (id === "item-500") return;
      expect(useQueueStore.getState().items[id]).toBe(reference);
    });
    expect(useQueueStore.getState().items["item-500"]?.progress).toBe(0.09);
  });

  it("re-renders a probe for one row exactly once while another row ticks", () => {
    useQueueStore
      .getState()
      .applyItems(Array.from({ length: 10 }, (_, index) => makeItem(index)));

    render(<RowProbe id="item-1" />);
    expect(renders.get("item-1")).toBe(1);

    act(() => {
      for (let tick = 0; tick < 1_000; tick += 1) {
        applyServerEvent({
          type: "item.progress",
          id: "item-7",
          progress: (tick % 90) / 100,
        });
      }
    });

    expect(renders.get("item-1")).toBe(1);
  });

  it("upserts by id: keeps order, replaces payload rows and appends new ids", () => {
    const seed = [makeItem(1), makeItem(2), makeItem(3)];
    useQueueStore.getState().applyItems(seed);
    const untouched = useQueueStore.getState().items["item-2"];

    useQueueStore.getState().applyItems([
      { ...makeItem(3), progress: 0.9 },
      makeItem(4),
    ]);

    const state = useQueueStore.getState();
    expect(state.ids).toEqual(["item-1", "item-2", "item-3", "item-4"]);
    expect(state.items["item-2"]).toBe(untouched);
    expect(state.items["item-3"]?.progress).toBe(0.9);
    expect(state.items["item-4"]?.id).toBe("item-4");
    expect(state.ids.filter((id) => id === "item-3")).toHaveLength(1);
  });

  it("does not write on an unchanged or unknown progress value", () => {
    useQueueStore.getState().applyItems([makeItem(1)]);
    const listener = vi.fn();
    const unsubscribe = useQueueStore.subscribe(listener);

    useQueueStore.getState().applyProgress("item-1", 0.1);
    useQueueStore.getState().applyProgress("missing", 0.5);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
