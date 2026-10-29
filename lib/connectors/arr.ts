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
  QueueItem,
  QueueStatus,
} from "./types";

interface ArrQuality {
  quality?: { name?: string };
  name?: string;
}

interface ArrQueueRecord {
  id?: number | string;
  title?: string;
  status?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  movie?: { title?: string; year?: number };
  series?: { title?: string };
  episode?: { seasonNumber?: number; episodeNumber?: number };
  quality?: ArrQuality;
}

interface ArrQueueResponse {
  records?: ArrQueueRecord[];
  totalRecords?: number;
  pageSize?: number;
}

interface ArrHealthRecord {
  type?: string;
  message?: string;
  source?: string;
}

type ArrKind = "movie" | "series";

interface ArrMeta {
  type: string;
  displayName: string;
  logo: string;
  kind: ArrKind;
}

function mapStatus(status: string | undefined): QueueStatus {
  switch ((status ?? "").toLowerCase()) {
    case "paused":
      return "paused";
    case "failed":
      return "failed";
    case "completed":
      return "seeding";
    default:
      // "queued", "warning" and everything else are still active queue entries.
      return "downloading";
  }
}

function mapProgress(record: ArrQueueRecord): number {
  const size = record.size ?? 0;
  const remaining = record.sizeleft ?? 0;
  if (size <= 0) return 0;
  const progress = 1 - remaining / size;
  return Math.min(1, Math.max(0, progress));
}

function mapSubLine(record: ArrQueueRecord, kind: ArrKind): string {
  if (kind === "movie") {
    return record.movie?.year ? String(record.movie.year) : "";
  }
  const season = record.episode?.seasonNumber;
  const episode = record.episode?.episodeNumber;
  if (season === undefined || episode === undefined) return "";
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

function mapQuality(record: ArrQueueRecord): string {
  return (
    record.quality?.quality?.name ??
    record.quality?.name ??
    "Unknown"
  );
}

export function mapArrQueueItem(
  record: ArrQueueRecord,
  serviceId: string,
  kind: ArrKind,
): QueueItem {
  const title =
    kind === "movie"
      ? (record.movie?.title ?? record.title ?? "Unknown")
      : (record.series?.title ?? record.title ?? "Unknown");

  return {
    id: String(record.id ?? ""),
    service: serviceId,
    title,
    sub: mapSubLine(record, kind),
    quality: mapQuality(record),
    progress: mapProgress(record),
    eta: record.timeleft ?? "—",
    status: mapStatus(record.status),
  };
}

async function fetchQueue(
  fetchImpl: FetchLike,
  baseUrl: string,
  headers: Record<string, string>,
  serviceId: string,
  kind: ArrKind,
): Promise<QueueItem[]> {
  const includeUnknown =
    kind === "movie"
      ? "includeUnknownMovieItems=true"
      : "includeUnknownSeriesItems=true";
  const requestedPageSize = 250;
  const maxPages = 200;
  const items: QueueItem[] = [];
  let effectivePageSize = requestedPageSize;
  let observedPageSize = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchImpl(
      `${baseUrl}/api/v3/queue?page=${page}&pageSize=${requestedPageSize}&${includeUnknown}`,
      { headers },
    );
    const data = await readJson<ArrQueueResponse>(
      response,
      `${serviceId} queue`,
    );
    const records = data.records ?? [];
    if (typeof data.pageSize === "number" && data.pageSize > 0) {
      effectivePageSize = data.pageSize;
    } else if (records.length > 0) {
      observedPageSize = Math.max(observedPageSize, records.length);
      effectivePageSize = Math.min(effectivePageSize, observedPageSize);
    }
    items.push(
      ...records.map((record) =>
        mapArrQueueItem(record, serviceId, kind),
      ),
    );

    if (records.length === 0) break;

    const total = data.totalRecords;
    if (typeof total === "number") {
      if (items.length >= total) break;
    } else if (records.length < effectivePageSize) {
      break;
    }
  }

  return items;
}

async function fetchErrors(
  fetchImpl: FetchLike,
  baseUrl: string,
  headers: Record<string, string>,
  serviceId: string,
): Promise<ErrorEvent[]> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/v3/health`, { headers });
    if (!response.ok) return [];
    const data = (await response.json()) as ArrHealthRecord[];
    return data.map((record) => ({
      severity:
        record.type === "error"
          ? "error"
          : record.type === "warning"
            ? "warning"
            : "info",
      service: serviceId,
      message: record.message ?? "Unknown health issue",
      at: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export function createArrConnector(
  service: ConnectorService,
  deps: ConnectorDeps | FetchLike | undefined,
  meta: ArrMeta,
): Connector {
  const fetchImpl = resolveFetch(deps);
  const baseUrl = serviceBaseUrl(service);
  const headers = apiKeyHeaders(service, "X-Api-Key");

  return {
    type: meta.type,
    displayName: meta.displayName,
    logo: meta.logo,
    hasWebEndpoint: true,
    async healthCheck() {
      try {
        const response = await fetchImpl(`${baseUrl}/api/v3/system/status`, {
          headers,
        });
        return statusFromResponse(response);
      } catch {
        return "unknown";
      }
    },
    async queue() {
      try {
        return await fetchQueue(fetchImpl, baseUrl, headers, service.id, meta.kind);
      } catch {
        return [];
      }
    },
    async errors() {
      return fetchErrors(fetchImpl, baseUrl, headers, service.id);
    },
  };
}
