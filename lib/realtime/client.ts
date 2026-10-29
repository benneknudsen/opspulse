"use client";

import type { ServerEvent } from "@/lib/events/types";
import { applyServerEvent } from "@/lib/realtime/apply";
import {
  RECONNECT_DELAYS_MS,
  reconnectDelay,
  useConnectionStore,
} from "@/lib/store/connection";

export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

export interface SocketTimers {
  setTimeout: (
    handler: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface SocketClientOptions {
  url: string;
  socketFactory?: () => SocketLike;
  timers?: SocketTimers;
}

export interface SocketClient {
  start(): void;
  dispose(): void;
}

declare global {
  interface Window {
    /** E2E seam: lets a Playwright spec point the app at a sidecar port. */
    __OPSPULSE_WS_URL__?: string;
  }
}

export function resolveSocketUrl(): string {
  if (typeof window !== "undefined" && window.__OPSPULSE_WS_URL__) {
    return window.__OPSPULSE_WS_URL__;
  }

  const configured = process.env.NEXT_PUBLIC_OPSPULSE_WS_URL;
  if (configured) return configured;

  const host =
    typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const port = process.env.NEXT_PUBLIC_OPSPULSE_WS_PORT ?? "8787";
  return `ws://${host}:${port}`;
}

const defaultTimers: SocketTimers = {
  setTimeout: (handler, delay) => setTimeout(handler, delay),
  clearTimeout: (handle) => clearTimeout(handle),
};

export function createSocketClient(
  options: SocketClientOptions,
): SocketClient {
  const socketFactory =
    options.socketFactory ??
    (() => new WebSocket(options.url) as unknown as SocketLike);
  const timers = options.timers ?? defaultTimers;

  let socket: SocketLike | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let started = false;
  let disposed = false;

  function clearTimer(): void {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  }

  function detach(current: SocketLike): void {
    current.onopen = null;
    current.onmessage = null;
    current.onclose = null;
    current.onerror = null;
  }

  function scheduleReconnect(): void {
    attempt += 1;
    useConnectionStore.getState().setStatus("reconnecting");

    if (attempt >= RECONNECT_DELAYS_MS.length) {
      useConnectionStore.getState().setStatus("lost");
    }

    clearTimer();
    timer = timers.setTimeout(() => {
      timer = null;
      connect();
    }, reconnectDelay(attempt));
  }

  function handleDown(current: SocketLike): void {
    if (disposed || current !== socket) return;

    socket = null;
    detach(current);
    scheduleReconnect();
  }

  function connect(): void {
    if (disposed) return;

    const current = socketFactory();
    socket = current;

    current.onopen = () => {
      if (current !== socket) return;
      attempt = 0;
      useConnectionStore.getState().setStatus("live");
    };

    current.onmessage = (event) => {
      if (current !== socket) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== "object") return;
      if (typeof (parsed as { type?: unknown }).type !== "string") return;

      applyServerEvent(parsed as ServerEvent);
    };

    current.onclose = () => handleDown(current);
    current.onerror = () => handleDown(current);
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;
      connect();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();

      const current = socket;
      socket = null;
      if (!current) return;

      detach(current);
      try {
        current.close();
      } catch {
        // The socket may already be closed; nothing left to release.
      }
    },
  };
}
