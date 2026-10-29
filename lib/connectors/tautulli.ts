import {
  apiKeyHeaders,
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

interface TautulliSession {
  session_id?: string | number;
  session_key?: string | number;
  friendly_name?: string;
  user?: string;
  title?: string;
  grandparent_title?: string;
  device?: string;
  player?: string;
  bitrate?: number;
  bandwidth?: number;
  transcode_decision?: string;
  started?: number;
}

interface TautulliResponse {
  response?: {
    result?: string;
    data?: {
      sessions?: TautulliSession[];
    };
  };
}

function startedAt(value: number | undefined): string {
  if (!value) return new Date(0).toISOString();
  return new Date(value * 1000).toISOString();
}

function toStream(session: TautulliSession, index: number): Stream {
  const decision = (session.transcode_decision ?? "").toLowerCase();
  return {
    id: String(session.session_id ?? session.session_key ?? index),
    user: session.friendly_name ?? session.user ?? "Unknown",
    device: session.device ?? session.player ?? "Unknown",
    title: session.title ?? session.grandparent_title ?? "Unknown",
    poster: "",
    bitrate: Number(session.bandwidth ?? session.bitrate ?? 0),
    mode: decision.includes("transcode") ? "transcode" : "direct",
    cpuPercent: 0,
    startedAt: startedAt(session.started),
  };
}

export function createTautulliConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const fetchImpl = resolveFetch(deps);
  const baseUrl = serviceBaseUrl(service);
  const headers = apiKeyHeaders(service, "X-Api-Key");
  const activityUrl = `${baseUrl}/api/v2?cmd=get_activity`;

  return {
    type: "tautulli",
    displayName: "Tautulli",
    logo: "tautulli",
    hasWebEndpoint: true,
    async healthCheck() {
      try {
        const response = await fetchImpl(activityUrl, { headers });
        return statusFromResponse(response);
      } catch {
        return "unknown";
      }
    },
    async streams() {
      try {
        const response = await fetchImpl(activityUrl, { headers });
        const data = await readJson<TautulliResponse>(
          response,
          "Tautulli activity",
        );
        return (data.response?.data?.sessions ?? []).map(toStream);
      } catch {
        return [];
      }
    },
  };
}
