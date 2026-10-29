import {
  readJson,
  resolveFetch,
  serviceBaseUrl,
  statusFromResponse,
} from "./http";
import type {
  Connector,
  ConnectorDeps,
  ConnectorService,
  FetchLike,
  Stream,
} from "./types";

interface PlexSession {
  sessionKey?: string | number;
  title?: string;
  grandparentTitle?: string;
  bitrate?: number;
  viewedAt?: number;
  User?: { title?: string; username?: string };
  Player?: { title?: string; device?: string };
  TranscodeSession?: unknown;
  Media?: Array<{ bitrate?: number }>;
}

interface PlexResponse {
  MediaContainer?: {
    Metadata?: PlexSession | PlexSession[];
  };
}

function normaliseSessions(sessions: PlexSession | PlexSession[] | undefined) {
  if (!sessions) return [];
  return Array.isArray(sessions) ? sessions : [sessions];
}

function startedAt(value: number | undefined): string {
  if (!value) return new Date(0).toISOString();
  return new Date(value * 1000).toISOString();
}

function toStream(session: PlexSession, index: number): Stream {
  const mode = session.TranscodeSession ? "transcode" : "direct";
  return {
    id: String(session.sessionKey ?? index),
    user: session.User?.title ?? session.User?.username ?? "Unknown",
    device: session.Player?.title ?? session.Player?.device ?? "Unknown",
    title: session.title ?? session.grandparentTitle ?? "Unknown",
    poster: "",
    bitrate: Number(session.bitrate ?? session.Media?.[0]?.bitrate ?? 0),
    mode,
    cpuPercent: 0,
    startedAt: startedAt(session.viewedAt),
  };
}

export function createPlexConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const fetchImpl = resolveFetch(deps);
  const baseUrl = serviceBaseUrl(service);
  const headers = {
    Accept: "application/json",
    "X-Plex-Token": service.token ?? service.apiKey ?? "",
  };

  return {
    type: "plex",
    displayName: "Plex",
    logo: "plex",
    hasWebEndpoint: true,
    async healthCheck() {
      try {
        const response = await fetchImpl(`${baseUrl}/identity`, { headers });
        return statusFromResponse(response);
      } catch {
        return "unknown";
      }
    },
    async streams() {
      try {
        const response = await fetchImpl(`${baseUrl}/status/sessions`, {
          headers,
        });
        const data = await readJson<PlexResponse>(response, "Plex sessions");
        return normaliseSessions(data.MediaContainer?.Metadata).map(toStream);
      } catch {
        return [];
      }
    },
  };
}
