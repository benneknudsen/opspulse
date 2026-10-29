"use client";

import { create } from "zustand";

import type { QueueItem } from "@/lib/connectors/types";

export interface QueueState {
  /**
   * Normalised rows keyed by id.
   *
   * `queue.updated` carries upsert/merge semantics: the server sends either
   * the full set (first frame) or a delta after an action. A row that is not
   * present in the payload is left untouched.
   */
  items: Record<string, QueueItem>;
  ids: string[];
  applyItems: (items: QueueItem[]) => void;
  applyProgress: (id: string, progress: number) => void;
  removeItem: (id: string) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  items: {},
  ids: [],
  applyItems: (payload) =>
    set((state) => {
      if (payload.length === 0) return state;

      const items = { ...state.items };
      const appended: string[] = [];

      for (const item of payload) {
        if (!Object.prototype.hasOwnProperty.call(items, item.id)) {
          appended.push(item.id);
        }
        items[item.id] = item;
      }

      return {
        items,
        ids: appended.length > 0 ? [...state.ids, ...appended] : state.ids,
      };
    }),
  applyProgress: (id, progress) =>
    set((state) => {
      const current = state.items[id];
      if (!current || current.progress === progress) return state;

      return { items: { ...state.items, [id]: { ...current, progress } } };
    }),
  removeItem: (id) =>
    set((state) => {
      if (!Object.prototype.hasOwnProperty.call(state.items, id)) return state;

      const items = { ...state.items };
      delete items[id];
      return { items, ids: state.ids.filter((candidate) => candidate !== id) };
    }),
  reset: () => set({ items: {}, ids: [] }),
}));

/**
 * Row-level subscription. The table must never subscribe to the whole `items`
 * map: a progress tick on row A would then re-render every row.
 */
export function useQueueItem(id: string): QueueItem | undefined {
  return useQueueStore((state) => state.items[id]);
}

export function useQueueIds(): string[] {
  return useQueueStore((state) => state.ids);
}
