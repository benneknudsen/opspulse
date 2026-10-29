import { createDockerConnector } from "./docker";
import { createOverseerrConnector } from "./overseerr";
import { createPlexConnector } from "./plex";
import { createRadarrConnector } from "./radarr";
import { createScrutinyConnector } from "./scrutiny";
import { createSonarrConnector } from "./sonarr";
import { createTautulliConnector } from "./tautulli";
import type {
  Connector,
  ConnectorDeps,
  ConnectorFactory,
  ConnectorService,
  FetchLike,
} from "./types";

const factories: Record<string, ConnectorFactory> = {
  radarr: createRadarrConnector,
  sonarr: createSonarrConnector,
  plex: createPlexConnector,
  tautulli: createTautulliConnector,
  scrutiny: createScrutinyConnector,
  overseerr: createOverseerrConnector,
  docker: createDockerConnector,
};

function displayNameFor(type: string): string {
  return type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createUnknownConnector(service: ConnectorService): Connector {
  return {
    type: service.type,
    displayName: displayNameFor(service.type) || service.type,
    logo: "",
    hasWebEndpoint: false,
    async healthCheck() {
      return "unknown";
    },
  };
}

export function createConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const factory = Object.prototype.hasOwnProperty.call(factories, service.type)
    ? factories[service.type]
    : undefined;
  if (!factory) return createUnknownConnector(service);
  return factory(service, deps);
}

export function listConnectorTypes(): string[] {
  return Object.keys(factories);
}
