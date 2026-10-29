import { beforeEach, describe, expect, it } from "vitest";

import {
  RECONNECT_DELAYS_MS,
  reconnectDelay,
  useConnectionStore,
} from "@/lib/store/connection";

describe("connection store", () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: "live",
      lastSync: null,
      attempt: 0,
      actionsEnabled: true,
    });
  });

  it("starts disconnected instead of claiming live", () => {
    const initial = useConnectionStore.getInitialState();
    expect(initial.status).toBe("connecting");
    expect(initial.actionsEnabled).toBe(false);
    expect(initial.attempt).toBe(0);
  });

  it.each(["connecting", "reconnecting", "lost"] as const)(
    "disables actions while %s",
    (status) => {
      useConnectionStore.getState().setStatus(status);
      expect(useConnectionStore.getState().actionsEnabled).toBe(false);
    },
  );

  it("enables actions while live", () => {
    useConnectionStore.getState().setStatus("reconnecting");
    useConnectionStore.getState().setStatus("live");
    expect(useConnectionStore.getState().actionsEnabled).toBe(true);
  });

  it("increments attempt per transition into reconnecting and resets on live", () => {
    useConnectionStore.getState().setStatus("reconnecting");
    useConnectionStore.getState().setStatus("reconnecting");
    useConnectionStore.getState().setStatus("lost");
    expect(useConnectionStore.getState().attempt).toBe(2);

    useConnectionStore.getState().setStatus("live");
    expect(useConnectionStore.getState().attempt).toBe(0);
  });

  it("exposes the 1/2/4/8/15 second reconnect schedule", () => {
    expect(RECONNECT_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 15000]);
    expect([1, 2, 3, 4, 5, 6, 10].map(reconnectDelay)).toEqual([
      1000, 2000, 4000, 8000, 15000, 15000, 15000,
    ]);
  });
});
