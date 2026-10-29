"use client";

import { create } from "zustand";

export const CONNECTION_STATUSES = [
  "live",
  "connecting",
  "reconnecting",
  "lost",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000] as const;

/**
 * 1-based attempt -> delay before the next connection attempt.
 * Attempts beyond the fifth keep retrying every 15 s; the status stays `lost`
 * until a connection succeeds, so a dashboard recovers without a reload.
 */
export function reconnectDelay(attempt: number): number {
  return RECONNECT_DELAYS_MS[attempt - 1] ?? 15000;
}

export interface ConnectionState {
  status: ConnectionStatus;
  lastSync: number | null;
  attempt: number;
  actionsEnabled: boolean;
  setStatus: (status: ConnectionStatus) => void;
  setLastSync: (lastSync: number | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connecting",
  lastSync: null,
  attempt: 0,
  actionsEnabled: false,
  setStatus: (status) =>
    set((state) => ({
      status,
      attempt:
        status === "live"
          ? 0
          : status === "reconnecting"
            ? state.attempt + 1
            : state.attempt,
      actionsEnabled: status === "live",
    })),
  setLastSync: (lastSync) => set({ lastSync }),
}));
