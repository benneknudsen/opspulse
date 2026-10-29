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
  ErrorEvent,
  FetchLike,
} from "./types";

interface OverseerrRequest {
  id?: number;
  status?: number;
  media?: { title?: string; name?: string };
  requestedBy?: { displayName?: string };
  updatedAt?: string;
  createdAt?: string;
}

interface OverseerrRequestResponse {
  results?: OverseerrRequest[];
}

export function createOverseerrConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const fetchImpl = resolveFetch(deps);
  const baseUrl = serviceBaseUrl(service);
  const headers = apiKeyHeaders(service, "X-Api-Key");

  return {
    type: "overseerr",
    displayName: "Overseerr",
    logo: "overseerr",
    hasWebEndpoint: true,
    async healthCheck() {
      try {
        const response = await fetchImpl(`${baseUrl}/api/v1/status`, {
          headers,
        });
        return statusFromResponse(response);
      } catch {
        return "unknown";
      }
    },
    async errors() {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/v1/request?take=50&filter=all`,
          { headers },
        );
        if (!response.ok) return [];
        const data = await readJson<OverseerrRequestResponse>(
          response,
          "Overseerr requests",
        );

        return (data.results ?? [])
          .filter((request) => request.status === 4)
          .map<ErrorEvent>((request) => ({
            severity: "error",
            service: service.id,
            message: `Request failed: ${
              request.media?.title ??
              request.media?.name ??
              request.requestedBy?.displayName ??
              `#${request.id ?? "unknown"}`
            }`,
            at: new Date(
              request.updatedAt ?? request.createdAt ?? Date.now(),
            ).toISOString(),
          }));
      } catch {
        return [];
      }
    },
  };
}
