import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";

import { expect, test } from "@playwright/test";

const PORT = 8799;
const URL = `ws://127.0.0.1:${PORT}`;

let sidecar: ChildProcess | null = null;

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`sidecar did not listen on ${port}`));
          return;
        }
        setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

async function startSidecar(): Promise<ChildProcess> {
  const child = spawn("npx", ["tsx", "server/ws.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, OPSPULSE_WS_PORT: String(PORT) },
    stdio: "ignore",
    detached: true,
  });
  await waitForPort(PORT);
  return child;
}

function killSidecar(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  });
}

test.describe.configure({ mode: "serial" });

test.describe("realtime reconnect", () => {
  test.beforeAll(async () => {
    sidecar = await startSidecar();
  });

  test.afterAll(async () => {
    await killSidecar(sidecar);
    sidecar = null;
  });

  test("reconnects without a reload after the sidecar dies", async ({ page }) => {
    await page.addInitScript((url) => {
      window.__OPSPULSE_WS_URL__ = url;

      type StatusEntry = { status: string; at: number };
      type SocketEntry = { type: "open" | "message"; at: number };
      type ProbeWindow = Window & {
        __opspulseStatusLog?: StatusEntry[];
        __opspulseSocketLog?: SocketEntry[];
      };
      const probe = window as ProbeWindow;
      probe.__opspulseStatusLog = [];
      probe.__opspulseSocketLog = [];

      const pushStatus = (status: string | null) => {
        if (!status) return;
        const log = probe.__opspulseStatusLog!;
        if (log[log.length - 1]?.status === status) return;
        log.push({ status, at: performance.now() });
      };

      const readStatus = () =>
        document
          .querySelector('[role="status"][data-status]')
          ?.getAttribute("data-status") ?? null;

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes" && mutation.oldValue) {
            pushStatus(mutation.oldValue);
          }
        }
        pushStatus(readStatus());
      }).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-status"],
      });

      const NativeWebSocket = window.WebSocket;
      class ProbeWebSocket extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          this.addEventListener("open", () => {
            probe.__opspulseSocketLog!.push({
              type: "open",
              at: performance.now(),
            });
          });
          this.addEventListener("message", () => {
            probe.__opspulseSocketLog!.push({
              type: "message",
              at: performance.now(),
            });
          });
        }
      }
      window.WebSocket = ProbeWebSocket as typeof WebSocket;
    }, URL);

    await page.goto("/");

    const pill = page.locator('[role="status"]');
    await expect(pill).toHaveAttribute("data-status", "live", {
      timeout: 10000,
    });

    const firstProbe = await page.evaluate(() => {
      const state = window as Window & {
        __opspulseStatusLog?: Array<{ status: string; at: number }>;
        __opspulseSocketLog?: Array<{ type: "open" | "message"; at: number }>;
      };
      return {
        statuses: state.__opspulseStatusLog ?? [],
        sockets: state.__opspulseSocketLog ?? [],
      };
    });
    expect(firstProbe.statuses[0]?.status).toBe("connecting");
    const firstLive = firstProbe.statuses.find(
      (entry) => entry.status === "live",
    );
    const firstOpen = firstProbe.sockets.find((entry) => entry.type === "open");
    const firstMessage = firstProbe.sockets.find(
      (entry) => entry.type === "message",
    );
    expect(firstLive).toBeDefined();
    expect(firstOpen).toBeDefined();
    expect(firstMessage).toBeDefined();
    expect(firstLive!.at).toBeGreaterThanOrEqual(firstOpen!.at);
    expect(firstMessage!.at).toBeGreaterThanOrEqual(firstOpen!.at);

    await page.evaluate(() => {
      (window as Window & { __opspulseNoReload?: number }).__opspulseNoReload =
        1;
    });

    await killSidecar(sidecar);
    sidecar = null;

    await expect(pill).toHaveAttribute("data-status", "reconnecting", {
      timeout: 2000,
    });

    sidecar = await startSidecar();

    await expect(pill).toHaveAttribute("data-status", "live", {
      timeout: 15000,
    });

    const finalProbe = await page.evaluate(() => {
      const state = window as Window & {
        __opspulseNoReload?: number;
        __opspulseStatusLog?: Array<{ status: string; at: number }>;
      };
      return {
        marker: state.__opspulseNoReload,
        statuses: (state.__opspulseStatusLog ?? []).map(
          (entry) => entry.status,
        ),
      };
    });
    expect(finalProbe.marker).toBe(1);
    expect(finalProbe.statuses[0]).toBe("connecting");
    expect(finalProbe.statuses).toContain("reconnecting");
    expect(finalProbe.statuses.at(-1)).toBe("live");
  });
});
