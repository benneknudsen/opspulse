// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mapArrQueueItem } from "@/lib/connectors/arr";
import { createDockerConnector } from "@/lib/connectors/docker";
import { createOverseerrConnector } from "@/lib/connectors/overseerr";
import { createPlexConnector } from "@/lib/connectors/plex";
import { createRadarrConnector } from "@/lib/connectors/radarr";
import {
  createConnector,
  listConnectorTypes,
} from "@/lib/connectors/registry";
import { createScrutinyConnector } from "@/lib/connectors/scrutiny";
import { createSonarrConnector } from "@/lib/connectors/sonarr";
import { createTautulliConnector } from "@/lib/connectors/tautulli";
import type { ConnectorService } from "@/lib/connectors/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function service(
  type: string,
  overrides: Partial<ConnectorService> = {},
): ConnectorService {
  return {
    id: type,
    type,
    url: `http://${type}.local/`,
    apiKey: "test-api-key",
    ...overrides,
  };
}

describe("connector registry", () => {
  it("lists exactly the seven registered connector types", () => {
    expect([...listConnectorTypes()].sort()).toEqual(
      [
        "radarr",
        "sonarr",
        "plex",
        "tautulli",
        "scrutiny",
        "overseerr",
        "docker",
      ].sort(),
    );
  });

  it("creates each registered connector with the expected type and web endpoint", () => {
    const expected: Record<string, boolean> = {
      radarr: true,
      sonarr: true,
      plex: true,
      tautulli: true,
      scrutiny: true,
      overseerr: true,
      docker: false,
    };

    for (const type of listConnectorTypes()) {
      const connector = createConnector(service(type));
      expect(connector.type).toBe(type);
      expect(connector.hasWebEndpoint).toBe(expected[type]);
    }
  });

  it("returns an unknown connector instead of throwing for an unknown type", async () => {
    const connector = createConnector({
      id: "community",
      type: "community-thing",
      url: "http://localhost:9999",
      apiKey: "secret",
    });

    expect(connector.type).toBe("community-thing");
    expect(connector.displayName).toBeTruthy();
    expect(connector.hasWebEndpoint).toBe(false);
    await expect(connector.healthCheck()).resolves.toBe("unknown");
  });
});

describe("radarr connector", () => {
  it("maps /api/v3/queue into typed QueueItem objects", async () => {
    let calledUrl = "";
    let calledHeaders: Headers | undefined;
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calledUrl = String(input);
      calledHeaders = new Headers(init?.headers);
      return jsonResponse({
        totalRecords: 1,
        records: [
          {
            id: 42,
            title: "Dune: Part Two",
            status: "downloading",
            size: 1000,
            sizeleft: 400,
            timeleft: "00:12:00",
            movie: { title: "Dune: Part Two", year: 2024 },
            quality: { quality: { name: "Bluray-1080p" } },
          },
        ],
      });
    };

    const connector = createRadarrConnector(service("radarr"), fetchMock);
    const items = await connector.queue?.();

    expect(calledUrl).toContain("/api/v3/queue");
    expect(calledHeaders?.get("X-Api-Key")).toBe("test-api-key");
    expect(items).toEqual([
      {
        id: "42",
        service: "radarr",
        title: "Dune: Part Two",
        sub: "2024",
        quality: "Bluray-1080p",
        progress: 0.6,
        eta: "00:12:00",
        status: "downloading",
      },
    ]);
  });

  it("returns an empty queue instead of throwing on an HTTP error", async () => {
    const fetchMock = async () => jsonResponse({ error: "boom" }, 500);
    const connector = createRadarrConnector(service("radarr"), fetchMock);

    await expect(connector.queue?.()).resolves.toEqual([]);
  });

  it("walks queue pages until totalRecords is reached", async () => {
    const calls: string[] = [];
    const firstPage = Array.from({ length: 250 }, (_, index) => ({
      id: index + 1,
      title: `Movie ${index + 1}`,
      status: "downloading",
      size: 100,
      sizeleft: 50,
      movie: { title: `Movie ${index + 1}` },
    }));
    const secondPage = Array.from({ length: 30 }, (_, index) => ({
      id: 251 + index,
      title: `Movie ${251 + index}`,
      status: "downloading",
      size: 100,
      sizeleft: 50,
      movie: { title: `Movie ${251 + index}` },
    }));

    const fetchMock = async (input: string | URL | Request) => {
      calls.push(String(input));
      return jsonResponse(
        calls.length === 1
          ? { records: firstPage, totalRecords: 280 }
          : { records: secondPage, totalRecords: 280 },
      );
    };

    const connector = createRadarrConnector(service("radarr"), fetchMock);
    const items = await connector.queue?.();

    expect(items).toHaveLength(280);
    expect(items?.[0]?.id).toBe("1");
    expect(items?.at(-1)?.id).toBe("280");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("page=2");
  });

  it("keeps walking when the server caps pageSize below the requested size", async () => {
    const calls: string[] = [];
    const totalRecords = 280;
    const serverPageSize = 100;

    const fetchMock = async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      const start = (page - 1) * serverPageSize;
      const count = Math.max(
        0,
        Math.min(serverPageSize, totalRecords - start),
      );
      const records = Array.from({ length: count }, (_, index) => {
        const id = start + index + 1;
        return {
          id,
          title: `Movie ${id}`,
          status: "downloading",
          size: 100,
          sizeleft: 50,
          movie: { title: `Movie ${id}` },
        };
      });
      return jsonResponse({ records, totalRecords, pageSize: serverPageSize });
    };

    const connector = createRadarrConnector(service("radarr"), fetchMock);
    const items = await connector.queue?.();

    expect(items).toHaveLength(280);
    expect(items?.[0]?.id).toBe("1");
    expect(items?.at(-1)?.id).toBe("280");
    expect(calls).toHaveLength(3);
    expect(calls[2]).toContain("page=3");
  });

  it("infers the page size from truncated pages when the server omits metadata", async () => {
    const calls: string[] = [];
    const totalRecords = 250;
    const serverPageSize = 100;

    const fetchMock = async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      const start = (page - 1) * serverPageSize;
      const count = Math.max(
        0,
        Math.min(serverPageSize, totalRecords - start),
      );
      const records = Array.from({ length: count }, (_, index) => {
        const id = start + index + 1;
        return {
          id,
          title: `Movie ${id}`,
          status: "downloading",
          size: 100,
          sizeleft: 50,
          movie: { title: `Movie ${id}` },
        };
      });
      return jsonResponse({ records });
    };

    const connector = createRadarrConnector(service("radarr"), fetchMock);
    const items = await connector.queue?.();

    expect(items).toHaveLength(250);
    expect(items?.[0]?.id).toBe("1");
    expect(items?.at(-1)?.id).toBe("250");
    expect(calls).toHaveLength(3);
    expect(calls[2]).toContain("page=3");
  });
});

describe("arr status mapping", () => {
  it("keeps warning and queued entries as active downloads", () => {
    expect(
      mapArrQueueItem({ status: "warning" }, "radarr", "movie").status,
    ).toBe("downloading");
    expect(
      mapArrQueueItem({ status: "queued" }, "radarr", "movie").status,
    ).toBe("downloading");
    expect(
      mapArrQueueItem({ status: "failed" }, "radarr", "movie").status,
    ).toBe("failed");
  });
});

describe("sonarr connector", () => {
  it("maps completed queue rows to seeding with an episode sub-line", async () => {
    const fetchMock = async () =>
      jsonResponse({
        totalRecords: 1,
        records: [
          {
            id: 7,
            title: "Blue Eye Samurai",
            status: "completed",
            size: 1000,
            sizeleft: 0,
            timeleft: "00:00:00",
            series: { title: "Blue Eye Samurai" },
            episode: { seasonNumber: 1, episodeNumber: 4 },
            quality: { quality: { name: "WEB-DL-1080p" } },
          },
        ],
      });

    const connector = createSonarrConnector(service("sonarr"), fetchMock);
    const items = await connector.queue?.();

    expect(items?.[0]).toMatchObject({
      id: "7",
      service: "sonarr",
      title: "Blue Eye Samurai",
      sub: "S01E04",
      quality: "WEB-DL-1080p",
      progress: 1,
      status: "seeding",
    });
  });
});

describe("plex connector", () => {
  it("maps /status/sessions into typed streams", async () => {
    let calledUrl = "";
    let calledHeaders: Headers | undefined;
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calledUrl = String(input);
      calledHeaders = new Headers(init?.headers);
      return jsonResponse({
        MediaContainer: {
          Metadata: [
            {
              sessionKey: "abc",
              title: "Dune: Part Two",
              type: "movie",
              bitrate: 18400,
              viewedAt: 1760000000,
              User: { title: "benne" },
              Player: { title: "Apple TV 4K" },
              TranscodeSession: { key: "xyz" },
            },
            {
              sessionKey: "def",
              title: "Blue Eye Samurai",
              bitrate: 7900,
              viewedAt: 1760000000,
              User: { title: "gæst" },
              Player: { title: "Chrome · macOS" },
            },
          ],
        },
      });
    };

    const connector = createPlexConnector(
      service("plex", { apiKey: undefined, token: "plex-token" }),
      fetchMock,
    );
    const streams = await connector.streams?.();

    expect(calledUrl).toContain("/status/sessions");
    expect(calledHeaders?.get("X-Plex-Token")).toBe("plex-token");
    expect(streams?.[0]).toMatchObject({
      id: "abc",
      user: "benne",
      device: "Apple TV 4K",
      title: "Dune: Part Two",
      bitrate: 18400,
      mode: "transcode",
    });
    expect(streams?.[1]).toMatchObject({
      id: "def",
      user: "gæst",
      mode: "direct",
    });
    expect(typeof streams?.[0]?.startedAt).toBe("string");
  });

  it("returns unknown from healthCheck on a network failure", async () => {
    const fetchMock = async () => {
      throw new Error("network down");
    };
    const connector = createPlexConnector(service("plex"), fetchMock);

    await expect(connector.healthCheck()).resolves.toBe("unknown");
  });
});

describe("tautulli connector", () => {
  it("maps get_activity sessions into typed streams", async () => {
    let calledUrl = "";
    const fetchMock = async (input: string | URL | Request) => {
      calledUrl = String(input);
      return jsonResponse({
        response: {
          result: "success",
          data: {
            sessions: [
              {
                session_id: "session-1",
                friendly_name: "benne",
                user: "benne",
                title: "Ripley",
                device: "iPhone 15",
                bitrate: 5100,
                transcode_decision: "direct play",
                started: 1760000000,
              },
            ],
          },
        },
      });
    };

    const connector = createTautulliConnector(service("tautulli"), fetchMock);
    const streams = await connector.streams?.();

    expect(calledUrl).toContain("cmd=get_activity");
    expect(streams?.[0]).toMatchObject({
      id: "session-1",
      user: "benne",
      device: "iPhone 15",
      title: "Ripley",
      bitrate: 5100,
      mode: "direct",
      cpuPercent: 0,
    });
  });

  it("sends the API key as a header and never in the URL", async () => {
    let calledUrl = "";
    let calledHeaders: Headers | undefined;
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calledUrl = String(input);
      calledHeaders = new Headers(init?.headers);
      return jsonResponse({ response: { result: "success", data: {} } });
    };

    const connector = createTautulliConnector(service("tautulli"), fetchMock);
    await connector.streams?.();

    expect(calledUrl).not.toContain("apikey");
    expect(calledUrl).not.toContain("test-api-key");
    expect(calledHeaders?.get("X-Api-Key")).toBe("test-api-key");
  });
});

describe("scrutiny connector", () => {
  it("maps the summary endpoint into a typed disk sample", async () => {
    const fetchMock = async () =>
      jsonResponse({
        data: {
          summary: [
            {
              device: { device_name: "/dev/sda" },
              temp: 44,
              smart_status: "passed",
              smart: { temperature: 44 },
            },
          ],
        },
      });

    const connector = createScrutinyConnector(service("scrutiny"), fetchMock);
    const sample = await connector.disk?.();

    expect(sample).toMatchObject({
      device: "/dev/sda",
      tempC: 44,
      smart: "ok",
    });
    expect(sample?.history).toEqual([44]);
  });
});

describe("overseerr connector", () => {
  it("reports up from /api/v1/status with the api key header", async () => {
    let calledUrl = "";
    let calledHeaders: Headers | undefined;
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calledUrl = String(input);
      calledHeaders = new Headers(init?.headers);
      return jsonResponse({ version: "1.33.0" });
    };

    const connector = createOverseerrConnector(service("overseerr"), fetchMock);

    await expect(connector.healthCheck()).resolves.toBe("up");
    expect(calledUrl).toContain("/api/v1/status");
    expect(calledHeaders?.get("X-Api-Key")).toBe("test-api-key");
  });
});

describe("docker connector", () => {
  it("maps /containers/json into typed containers through an injected socket client", async () => {
    const paths: string[] = [];
    const connector = createDockerConnector(service("docker"), {
      dockerRequest: async (path) => {
        paths.push(path);
        return {
          statusCode: 200,
          body: JSON.stringify([
            {
              Id: "one",
              Names: ["/radarr"],
              State: "running",
              Status: "Up 2 days",
            },
            {
              Id: "two",
              Names: ["/watchtower"],
              State: "restarting",
              Status: "Restarting (1) 2 seconds ago",
            },
            {
              Id: "three",
              Names: ["/paused"],
              State: "paused",
              Status: "Up 2 days (Paused)",
            },
          ]),
        };
      },
    });

    const containers = await connector.containers?.();

    expect(paths[0]).toContain("/containers/json");
    expect(containers).toEqual([
      { name: "radarr", state: "up", uptime: "Up 2 days" },
      {
        name: "watchtower",
        state: "restarting",
        uptime: "Restarting (1) 2 seconds ago",
      },
      { name: "paused", state: "down", uptime: "Up 2 days (Paused)" },
    ]);
  });

  it("returns unknown status when the local docker socket is missing", async () => {
    const missing = Object.assign(new Error("connect ENOENT"), {
      code: "ENOENT",
    });
    const connector = createDockerConnector(service("docker"), {
      dockerRequest: async () => {
        throw missing;
      },
    });

    await expect(connector.healthCheck()).resolves.toBe("unknown");
    await expect(connector.containers?.()).resolves.toEqual([]);
  });
});
