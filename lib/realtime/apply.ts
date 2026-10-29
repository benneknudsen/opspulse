import type { ServerEvent } from "@/lib/events/types";
import { useConnectionStore } from "@/lib/store/connection";
import { useFeedStore } from "@/lib/store/feed";
import { useQueueStore } from "@/lib/store/queue";

/**
 * Single pure mapping from server events onto the client stores.
 *
 * `connector.status`, `stream.updated`, `disk.sample`, `container.state` and
 * `action.result` have no store yet. Their widgets arrive in a later issue, so
 * for now they only refresh `lastSync`; no placeholder stores are invented.
 */
export function applyServerEvent(event: ServerEvent): void {
  switch (event.type) {
    case "queue.updated":
      useQueueStore.getState().applyItems(event.items);
      break;
    case "item.progress":
      useQueueStore.getState().applyProgress(event.id, event.progress);
      break;
    case "feed.appended":
      useFeedStore.getState().append(event.event);
      break;
    case "connector.status":
    case "stream.updated":
    case "disk.sample":
    case "container.state":
    case "error.appended":
    case "action.result":
      // `remove` has no client-side representation yet: the frozen ServerEvent
      // union has no removal event and SocketLike has no `send`, so optimistic
      // actions belong to issue #18.
      break;
    default:
      return;
  }

  useConnectionStore.getState().setLastSync(Date.now());
}
