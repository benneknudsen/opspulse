import { createArrConnector } from "./arr";
import type { Connector, ConnectorDeps, ConnectorService, FetchLike } from "./types";

export function createRadarrConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  return createArrConnector(service, deps, {
    type: "radarr",
    displayName: "Radarr",
    logo: "radarr",
    kind: "movie",
  });
}
