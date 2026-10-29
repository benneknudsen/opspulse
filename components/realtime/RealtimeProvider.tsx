"use client";

import { useEffect, type ReactNode } from "react";

import { createSocketClient, resolveSocketUrl } from "@/lib/realtime/client";
import { useConnectionStore } from "@/lib/store/connection";

/**
 * Owns the single client socket for the whole app. Rendered from the root
 * layout (not from `Shell`) so rendering the shell in isolation never opens a
 * connection.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Nothing is connected on mount, so the store must not claim `live`.
    useConnectionStore.getState().setStatus("connecting");

    const client = createSocketClient({ url: resolveSocketUrl() });
    client.start();

    return () => client.dispose();
  }, []);

  return <>{children}</>;
}
