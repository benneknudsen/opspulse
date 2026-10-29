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
  SmartStatus,
} from "./types";

interface ScrutinyEntry {
  device?: { device_name?: string; name?: string };
  device_name?: string;
  temp?: number;
  temperature?: number;
  smart_status?: string | boolean | { passed?: boolean };
  smart?: {
    temperature?: number;
    power_on_hours?: number;
    smart_status?: { passed?: boolean };
  };
}

interface ScrutinyResponse {
  data?: {
    summary?: ScrutinyEntry[];
  };
}

function readSmart(entry: ScrutinyEntry): SmartStatus {
  const status = entry.smart_status;
  if (status === true) return "ok";
  if (status === false) return "failed";
  if (typeof status === "string") {
    const normalised = status.toLowerCase();
    if (normalised === "passed" || normalised === "ok") return "ok";
    if (normalised === "failed" || normalised === "fail") return "failed";
    if (normalised === "warning") return "warning";
  }
  if (typeof status === "object" && status?.passed === true) return "ok";
  if (entry.smart?.smart_status?.passed === true) return "ok";
  return "warning";
}

export function createScrutinyConnector(
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
): Connector {
  const fetchImpl = resolveFetch(deps);
  const baseUrl = serviceBaseUrl(service);
  const headers = { Accept: "application/json" };

  return {
    type: "scrutiny",
    displayName: "Scrutiny",
    logo: "scrutiny",
    hasWebEndpoint: true,
    async healthCheck() {
      try {
        const response = await fetchImpl(`${baseUrl}/api/summary`, { headers });
        return statusFromResponse(response);
      } catch {
        return "unknown";
      }
    },
    async disk() {
      try {
        const response = await fetchImpl(`${baseUrl}/api/summary`, { headers });
        const data = await readJson<ScrutinyResponse>(
          response,
          "Scrutiny summary",
        );
        const entry = data.data?.summary?.[0];
        if (!entry) {
          return {
            device: "Media",
            tempC: 0,
            minC: 0,
            maxC: 0,
            smart: "warning",
            uptime: "—",
            history: [],
            at: new Date().toISOString(),
          };
        }

        const tempC = Number(
          entry.temp ?? entry.smart?.temperature ?? entry.temperature ?? 0,
        );
        const hours = entry.smart?.power_on_hours;

        return {
          device:
            entry.device?.device_name ??
            entry.device?.name ??
            entry.device_name ??
            "Media",
          tempC,
          minC: tempC,
          maxC: tempC,
          smart: readSmart(entry),
          uptime: hours === undefined ? "—" : `${hours}h`,
          history: [tempC],
          at: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    },
  };
}
