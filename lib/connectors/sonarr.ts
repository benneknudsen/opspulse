import { createArrConnector } from "./arr";
import type { Connector, ConnectorDeps, ConnectorService, FetchLike } from "./types";

export function createSonarrConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  return createArrConnector(service, deps, {
    type: "sonarr",
    displayName: "Sonarr",
    logo: "sonarr",
    kind: "series",
  });
}
