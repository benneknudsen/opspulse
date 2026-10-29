import type {
  ConnectorDeps,
  ConnectorService,
  ConnectorStatus,
  FetchLike,
} from "./types";

export function resolveFetch(deps?: ConnectorDeps | FetchLike): FetchLike {
  if (typeof deps === "function") return deps;
  return deps?.fetch ?? fetch;
}

export function serviceBaseUrl(service: ConnectorService): string {
  return service.url.replace(/\/+$/, "");
}

export function apiKeyHeaders(
  service: ConnectorService,
  header: string,
): Record<string, string> {
  return {
    Accept: "application/json",
    [header]: service.apiKey ?? service.token ?? "",
  };
}

export function statusFromResponse(response: Response): ConnectorStatus {
  if (response.ok) return "up";
  return response.status >= 500 ? "degraded" : "down";
}

export async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${label} responded with ${response.status}`);
  }
  return (await response.json()) as T;
}
