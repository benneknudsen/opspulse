import type {
  Container,
  DiskSample,
  ErrorEvent,
  FeedEvent,
  QueueItem,
  QueueStatus,
  Stream,
} from "./types";

export const DEMO_SEED = 0x5eed1234;
export const DEMO_NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
export const DEMO_QUEUE_SIZE = 12_480;

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export interface DemoSnapshot {
  queue: QueueItem[];
  feed: FeedEvent[];
  streams: Stream[];
  containers: Container[];
  diskHistory: DiskSample[];
  errors: ErrorEvent[];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function posterFor(title: string): string {
  const hue = hashCode(title) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180" viewBox="0 0 120 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 30%)"/><stop offset="1" stop-color="hsl(${(hue + 42) % 360} 55% 12%)"/></linearGradient></defs><rect width="120" height="180" fill="url(#g)"/><rect x="8" y="8" width="104" height="164" fill="none" stroke="hsla(0 0% 100% / 0.18)"/><text x="60" y="93" text-anchor="middle" fill="hsl(210 20% 92%)" font-family="sans-serif" font-size="10">${escapeXml(title)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const MOVIE_TITLES = [
  "Dune: Part Two",
  "Sinners",
  "The Fantastic Four: First Steps",
  "Superman",
  "Avatar: Fire and Ash",
  "Weapons",
  "Ripley",
  "Oppenheimer",
  "Poor Things",
  "The Zone of Interest",
  "Anatomy of a Fall",
  "Past Lives",
];

const SERIES_TITLES = [
  "Blue Eye Samurai",
  "KPop Demon Hunters",
  "Arcane",
  "Shogun",
  "Severance",
  "The Bear",
  "Slow Horses",
  "Fallout",
  "Andor",
  "The Last of Us",
  "Silo",
  "Dark Matter",
];

const QUALITIES = [
  "Bluray-2160p",
  "Bluray-1080p",
  "WEB-DL-2160p",
  "WEB-DL-1080p",
  "HDTV-1080p",
];

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length]!;
}

function makeQueue(rng: () => number): QueueItem[] {
  const rows: QueueItem[] = [];

  for (let index = 0; index < DEMO_QUEUE_SIZE; index += 1) {
    const isMovie = index % 2 === 0;
    const title = isMovie
      ? pick(MOVIE_TITLES, index + Math.floor(rng() * MOVIE_TITLES.length))
      : pick(SERIES_TITLES, index + Math.floor(rng() * SERIES_TITLES.length));
    const roll = rng();
    const status: QueueStatus =
      roll < 0.018
        ? "paused"
        : roll < 0.032
          ? "failed"
          : roll < 0.31
            ? "seeding"
            : "downloading";

    const rawProgress = rng();
    const progress =
      status === "seeding"
        ? 1
        : status === "paused"
          ? 0
          : Math.round(Math.min(0.99, Math.max(0.01, rawProgress)) * 10_000) /
            10_000;
    const eta =
      status === "downloading" ? `${Math.floor(rng() * 118) + 2} min` : "—";
    const sub = isMovie
      ? String(2019 + (index % 8))
      : `S${String((index % 6) + 1).padStart(2, "0")}E${String(
          (index % 12) + 1,
        ).padStart(2, "0")}`;

    rows.push({
      id: `demo-${String(index + 1).padStart(5, "0")}`,
      service: isMovie ? "radarr" : "sonarr",
      title,
      sub,
      quality: pick(QUALITIES, index + Math.floor(rng() * QUALITIES.length)),
      progress,
      eta,
      status,
    });
  }

  return rows;
}

const FEED_TEMPLATES = [
  {
    service: "radarr",
    title: "Ripley",
    sub: "Download finished",
    severity: "ok" as const,
    minutesAgo: 2,
  },
  {
    service: "sonarr",
    title: "KPop Demon Hunters S01E01",
    sub: "Import finished",
    severity: "ok" as const,
    minutesAgo: 6,
  },
  {
    service: "unpackerr",
    title: "Avatar: Fire and Ash",
    sub: "Unpack failed",
    severity: "error" as const,
    minutesAgo: 9,
  },
  {
    service: "plex",
    title: "Dune: Part Two",
    sub: "Added to library",
    severity: "ok" as const,
    minutesAgo: 14,
  },
  {
    service: "radarr",
    title: "The Fantastic Four: First Steps",
    sub: "Download started",
    severity: "ok" as const,
    minutesAgo: 18,
  },
  {
    service: "overseerr",
    title: "Weapons",
    sub: "Grab failed (indexer timeout)",
    severity: "error" as const,
    minutesAgo: 24,
  },
  {
    service: "maintainerr",
    title: "Season 2",
    sub: "41 files removed",
    severity: "ok" as const,
    minutesAgo: 31,
  },
  {
    service: "scrutiny",
    title: "SMART attribute 5",
    sub: "Reallocated sectors on Media",
    severity: "warn" as const,
    minutesAgo: 46,
  },
];

function makeFeed(): FeedEvent[] {
  return FEED_TEMPLATES.map((template, index) => ({
    id: `feed-${index + 1}`,
    service: template.service,
    title: template.title,
    sub: template.sub,
    severity: template.severity,
    at: new Date(DEMO_NOW - template.minutesAgo * MINUTE).toISOString(),
    poster: posterFor(template.title),
  }));
}

const STREAM_TEMPLATES = [
  {
    user: "benne",
    title: "Dune: Part Two",
    device: "Apple TV 4K",
    bitrate: 18_400,
    mode: "direct" as const,
    cpuPercent: 0,
    minutesAgo: 42,
  },
  {
    user: "gæst",
    title: "Blue Eye Samurai",
    device: "Chrome · macOS",
    bitrate: 7_900,
    mode: "transcode" as const,
    cpuPercent: 68,
    minutesAgo: 11,
  },
  {
    user: "benne",
    title: "Ripley",
    device: "iPhone 15",
    bitrate: 5_100,
    mode: "direct" as const,
    cpuPercent: 0,
    minutesAgo: 3,
  },
];

function makeStreams(): Stream[] {
  return STREAM_TEMPLATES.map((template, index) => ({
    id: `stream-${index + 1}`,
    user: template.user,
    device: template.device,
    title: template.title,
    poster: posterFor(template.title),
    bitrate: template.bitrate,
    mode: template.mode,
    cpuPercent: template.cpuPercent,
    startedAt: new Date(DEMO_NOW - template.minutesAgo * MINUTE).toISOString(),
  }));
}

const CONTAINER_TEMPLATES: Array<{
  name: string;
  state: Container["state"];
  uptime: string;
}> = [
  { name: "radarr", state: "up", uptime: "Up 14d 6h" },
  { name: "sonarr", state: "up", uptime: "Up 14d 6h" },
  { name: "prowlarr", state: "up", uptime: "Up 14d 6h" },
  { name: "tautulli", state: "up", uptime: "Up 14d 5h" },
  { name: "kometa", state: "up", uptime: "Up 9d 2h" },
  { name: "maintainerr", state: "up", uptime: "Up 9d 2h" },
  { name: "unpackerr", state: "up", uptime: "Up 14d 6h" },
  { name: "overseerr", state: "up", uptime: "Up 14d 6h" },
  { name: "flaresolverr", state: "up", uptime: "Up 6d 11h" },
  { name: "scrutiny", state: "up", uptime: "Up 14d 6h" },
  { name: "portainer", state: "up", uptime: "Up 14d 6h" },
  {
    name: "watchtower",
    state: "restarting",
    uptime: "Restarting (1) 2 seconds ago",
  },
];

function makeContainers(): Container[] {
  return CONTAINER_TEMPLATES.map((container) => ({ ...container }));
}

function makeDiskHistory(rng: () => number): DiskSample[] {
  const temperatures = Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin((index / 24) * Math.PI * 2) * 5;
    return Math.round(41 + wave + rng() * 2);
  });
  const minC = Math.min(...temperatures);
  const maxC = Math.max(...temperatures);

  return temperatures.map((tempC, index) => ({
    device: "Media",
    tempC,
    minC,
    maxC,
    smart: "ok",
    uptime: "27d 4h",
    history: temperatures.slice(0, index + 1),
    at: new Date(DEMO_NOW - (23 - index) * HOUR).toISOString(),
  }));
}

const ERROR_TEMPLATES = [
  {
    severity: "error" as const,
    service: "unpackerr",
    message: "Unpack failed · Avatar: Fire and Ash",
    minutesAgo: 9,
  },
  {
    severity: "warning" as const,
    service: "scrutiny",
    message: "SMART attribute 5 reallocated sectors",
    minutesAgo: 46,
  },
  {
    severity: "warning" as const,
    service: "radarr",
    message: "Health check failed · indexer timeout",
    minutesAgo: 61,
  },
  {
    severity: "info" as const,
    service: "watchtower",
    message: "Container stopped during image update",
    minutesAgo: 6,
  },
];

function makeErrors(): ErrorEvent[] {
  return ERROR_TEMPLATES.map((template) => ({
    severity: template.severity,
    service: template.service,
    message: template.message,
    at: new Date(DEMO_NOW - template.minutesAgo * MINUTE).toISOString(),
  }));
}

export function createDemoSnapshot(seed: number = DEMO_SEED): DemoSnapshot {
  const rng = mulberry32(seed);
  return {
    queue: makeQueue(rng),
    feed: makeFeed(),
    streams: makeStreams(),
    containers: makeContainers(),
    diskHistory: makeDiskHistory(rng),
    errors: makeErrors(),
  };
}

export function demoSnapshot(): DemoSnapshot {
  return createDemoSnapshot();
}

export function demoQueue(): QueueItem[] {
  return createDemoSnapshot().queue;
}

export function demoFeed(): FeedEvent[] {
  return createDemoSnapshot().feed;
}

export function demoStreams(): Stream[] {
  return createDemoSnapshot().streams;
}

export function demoContainers(): Container[] {
  return createDemoSnapshot().containers;
}

export function demoDiskHistory(): DiskSample[] {
  return createDemoSnapshot().diskHistory;
}

export function demoDisk(): DiskSample | undefined {
  return demoDiskHistory().at(-1);
}

export function demoErrors(): ErrorEvent[] {
  return createDemoSnapshot().errors;
}
