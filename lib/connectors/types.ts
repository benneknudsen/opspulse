export type ConnectorStatus = "up" | "down" | "degraded" | "unknown";

export type QueueStatus = "downloading" | "seeding" | "paused" | "failed";

export type StreamMode = "direct" | "transcode";

export type SmartStatus = "ok" | "warning" | "failed";

export type ContainerState = "up" | "down" | "restarting";

export type ErrorSeverity = "error" | "warning" | "info";

export type FeedSeverity = "ok" | "warn" | "error";

export interface QueueItem {
  id: string;
  service: string;
  title: string;
  sub: string;
  quality: string;
  progress: number;
  eta: string;
  status: QueueStatus;
}

export interface Stream {
  id: string;
  user: string;
  device: string;
  title: string;
  poster: string;
  bitrate: number;
  mode: StreamMode;
  cpuPercent: number;
  startedAt: string;
}

export interface DiskSample {
  device: string;
  tempC: number;
  minC: number;
  maxC: number;
  smart: SmartStatus;
  uptime: string;
  history: number[];
  at: string;
}

export interface Container {
  name: string;
  state: ContainerState;
  uptime: string;
}

export interface ErrorEvent {
  severity: ErrorSeverity;
  service: string;
  message: string;
  at: string;
}

export interface FeedEvent {
  id: string;
  service: string;
  title: string;
  sub: string;
  severity: FeedSeverity;
  at: string;
  poster: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface DockerResponse {
  statusCode: number;
  body: string;
}

export type DockerRequest = (path: string) => Promise<DockerResponse>;

export interface ConnectorDeps {
  fetch?: FetchLike;
  dockerRequest?: DockerRequest;
}

export interface ConnectorService {
  id: string;
  type: string;
  url: string;
  apiKey?: string;
  token?: string;
}

export interface Connector {
  type: string;
  displayName: string;
  logo: string;
  hasWebEndpoint: boolean;
  healthCheck(): Promise<ConnectorStatus>;
  queue?(): Promise<QueueItem[]>;
  streams?(): Promise<Stream[]>;
  disk?(): Promise<DiskSample | null>;
  containers?(): Promise<Container[]>;
  errors?(): Promise<ErrorEvent[]>;
}

export type ConnectorFactory = (
  service: ConnectorService,
  deps?: ConnectorDeps | FetchLike,
) => Connector;
