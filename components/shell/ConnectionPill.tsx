"use client";

import { useT } from "@/lib/i18n";
import {
  useConnectionStore,
  type ConnectionStatus,
} from "@/lib/store/connection";

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  live: "topbar.connected",
  connecting: "topbar.connecting",
  reconnecting: "topbar.reconnecting",
  lost: "topbar.disconnected",
};

const STATUS_STYLE: Record<ConnectionStatus, string> = {
  live: "text-ok",
  connecting: "text-muted",
  reconnecting: "text-warn",
  lost: "text-danger",
};

const DOT_STYLE: Record<ConnectionStatus, string> = {
  live: "bg-ok animate-live-pulse motion-reduce:animate-none",
  connecting: "bg-muted",
  reconnecting: "bg-warn",
  lost: "bg-danger",
};

export function ConnectionPill() {
  const t = useT();
  const status = useConnectionStore((state) => state.status);

  return (
    <span
      role="status"
      aria-live="polite"
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-2 py-0.5 text-12 font-medium ${STATUS_STYLE[status]}`}
    >
      <i
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${DOT_STYLE[status]}`}
      />
      <span>{t(STATUS_TEXT[status])}</span>
    </span>
  );
}
