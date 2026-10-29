import type {
  ConnectorStatus,
  Container,
  DiskSample,
  ErrorEvent,
  FeedEvent,
  QueueItem,
  Stream,
} from "@/lib/connectors/types";

export interface QueueUpdatedEvent {
  type: "queue.updated";
  items: QueueItem[];
}

export interface ItemProgressEvent {
  type: "item.progress";
  id: string;
  progress: number;
}

export interface FeedAppendedEvent {
  type: "feed.appended";
  event: FeedEvent;
}

export interface StreamUpdatedEvent {
  type: "stream.updated";
  stream: Stream;
}

export interface DiskSampleEvent {
  type: "disk.sample";
  sample: DiskSample;
}

export interface ContainerStateEvent {
  type: "container.state";
  container: Container;
}

export interface ErrorAppendedEvent {
  type: "error.appended";
  error: ErrorEvent;
}

export interface ConnectorStatusEvent {
  type: "connector.status";
  id: string;
  status: ConnectorStatus;
}

export interface ActionResultEvent {
  type: "action.result";
  id: string;
  ok: boolean;
  reason?: string;
}

export type ServerEvent =
  | QueueUpdatedEvent
  | ItemProgressEvent
  | FeedAppendedEvent
  | StreamUpdatedEvent
  | DiskSampleEvent
  | ContainerStateEvent
  | ErrorAppendedEvent
  | ConnectorStatusEvent
  | ActionResultEvent;
