import { request as httpRequest } from "node:http";
import type {
  Connector,
  ConnectorDeps,
  ConnectorService,
  Container,
  ContainerState,
  DockerRequest,
  FetchLike,
} from "./types";

const DEFAULT_SOCKET = "/var/run/docker.sock";

interface DockerContainer {
  Id?: string;
  Names?: string[];
  State?: string;
  Status?: string;
}

function defaultDockerRequest(socketPath: string): DockerRequest {
  return (path) =>
    new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          socketPath,
          path,
          method: "GET",
          headers: { Host: "localhost", Accept: "application/json" },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({ statusCode: response.statusCode ?? 0, body });
          });
        },
      );
      request.on("error", reject);
      request.end();
    });
}

function mapContainer(container: DockerContainer): Container {
  const name =
    container.Names?.[0]?.replace(/^\//, "") ?? container.Id ?? "unknown";
  const rawState = (container.State ?? "").toLowerCase();
  const state: ContainerState =
    rawState === "running"
      ? "up"
      : rawState === "restarting"
        ? "restarting"
        : "down";
  // A paused container is not serving requests, so it counts as down.

  return {
    name,
    state,
    uptime: container.Status ?? "—",
  };
}

export function createDockerConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const request =
    typeof deps === "object" && deps?.dockerRequest
      ? deps.dockerRequest
      : defaultDockerRequest(process.env.DOCKER_SOCKET ?? DEFAULT_SOCKET);

  return {
    type: "docker",
    displayName: "Docker",
    logo: "docker",
    hasWebEndpoint: false,
    async healthCheck() {
      try {
        const response = await request("/version");
        if (response.statusCode === 200) return "up";
        if (response.statusCode >= 500) return "degraded";
        return "down";
      } catch {
        return "unknown";
      }
    },
    async containers() {
      try {
        const response = await request("/containers/json?all=1");
        if (response.statusCode !== 200) return [];
        const data = JSON.parse(response.body) as DockerContainer[];
        return data.map(mapContainer);
      } catch {
        return [];
      }
    },
  };
}
