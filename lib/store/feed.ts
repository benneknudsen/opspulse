"use client";

import { create } from "zustand";

import type { FeedEvent } from "@/lib/connectors/types";

export const FEED_CAP = 200;
export const FEED_INITIAL_VISIBLE = 6;
export const FEED_PAGE = 6;

export interface FeedState {
  events: FeedEvent[];
  visibleCount: number;
  append: (event: FeedEvent) => void;
  showMore: () => void;
  reset: () => void;
}

const initial = {
  events: [] as FeedEvent[],
  visibleCount: FEED_INITIAL_VISIBLE,
};

export const useFeedStore = create<FeedState>((set) => ({
  ...initial,
  append: (event) =>
    set((state) => {
      if (state.events.some((existing) => existing.id === event.id)) {
        return state;
      }

      const events = [event, ...state.events];
      if (events.length > FEED_CAP) events.length = FEED_CAP;

      return { events };
    }),
  showMore: () =>
    set((state) => ({
      visibleCount: Math.min(
        state.events.length,
        state.visibleCount + FEED_PAGE,
      ),
    })),
  reset: () => set({ ...initial }),
}));
