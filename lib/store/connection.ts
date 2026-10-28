"use client";

import { create } from "zustand";

export const CONNECTION_STATUSES = [
  "live",
  "connecting",
  "reconnecting",
  "lost",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface ConnectionState {
  status: ConnectionStatus;
  lastSync: number | null;
  setStatus: (status: ConnectionStatus) => void;
  setLastSync: (lastSync: number | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "live",
  lastSync: null,
  setStatus: (status) => set({ status }),
  setLastSync: (lastSync) => set({ lastSync }),
}));
