// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  assertServerRuntime,
  loadConfig,
  maskSecret,
  parseConfig,
  toClientConfig,
} from "@/lib/config/load";

const CONFIG_YAML = `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: \${RADARR_API_KEY}
  - id: plex
    type: plex
    url: http://localhost:32400
    token: \${PLEX_TOKEN}
ui:
  theme: dark
  language: da
  density: comfortable
widgets:
  - [0, 0, 3, 2]
  - [3, 0, 3, 2]
`;

const ENV = {
  RADARR_API_KEY: "radarr-api-key-1234",
  PLEX_TOKEN: "plex-token-abcd",
};

describe("config schema and loading", () => {
  it("resolves ${ENV_VAR} references from the environment", () => {
    const config = parseConfig(CONFIG_YAML, { env: ENV });

    expect(config.services).toHaveLength(2);
    expect(config.services[0]?.apiKey).toBe("radarr-api-key-1234");
    expect(config.services[1]?.token).toBe("plex-token-abcd");
    expect(config.widgets).toEqual([
      [0, 0, 3, 2],
      [3, 0, 3, 2],
    ]);
  });

  it("names the missing environment variable in the error", () => {
    expect(() => parseConfig(CONFIG_YAML, { env: {} })).toThrow(
      /RADARR_API_KEY/,
    );
    expect(() => parseConfig(CONFIG_YAML, { env: {} })).toThrow(ConfigError);
  });

  it("rejects a service that carries both api_key and token", () => {
    const invalid = `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: one
    token: two
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`;

    expect(() => parseConfig(invalid, { env: {} })).toThrow(/both/i);
  });

  it("requires api_key for keyed connectors and token for Plex", () => {
    const withoutKey = `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`;

    expect(() => parseConfig(withoutKey, { env: {} })).toThrow(/api_key|token/i);
    expect(() =>
      parseConfig(
        `services:
  - id: plex
    type: plex
    url: http://localhost:32400
    api_key: wrong
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`,
        { env: {} },
      ),
    ).toThrow(/token/i);
  });

  it("accepts an unknown connector type without validation failure", () => {
    const config = parseConfig(
      `services:
  - id: community
    type: my-community-connector
    url: http://localhost:9999
    api_key: secret-value
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`,
      { env: {} },
    );

    expect(config.services[0]?.type).toBe("my-community-connector");
  });

  it("loads a yaml file from an explicit path", () => {
    const directory = mkdtempSync(join(tmpdir(), "opspulse-config-"));
    const path = join(directory, "opspulse.yaml");
    writeFileSync(path, CONFIG_YAML);

    const config = loadConfig({ path, env: ENV });

    expect(config.services[0]?.apiKey).toBe("radarr-api-key-1234");
  });

  it("masks short keys completely and long keys with the last four characters", () => {
    expect(maskSecret("abc")).toBe("••••••••");
    expect(maskSecret("short")).toBe("••••••••");
    expect(maskSecret("1234567")).toBe("••••••••");
    expect(maskSecret("12345678")).toBe("••••••••");
    expect(maskSecret("12345678901")).toBe("••••••••");
    expect(maskSecret("123456789012")).toBe("••••••••9012");
    expect(maskSecret("radarr-api-key-1234")).toBe("••••••••1234");
  });

  it("builds a client DTO that never carries the raw secret", () => {
    const config = parseConfig(CONFIG_YAML, { env: ENV });
    const dto = toClientConfig(config);
    const serialised = JSON.stringify(dto);

    expect(dto.services[0]?.maskedKey).toBe("••••••••1234");
    expect(serialised).not.toContain("radarr-api-key-1234");
    expect(serialised).not.toContain("plex-token-abcd");
    expect(serialised).not.toMatch(/api_key|apiKey|"token"/);
    expect(dto.services[0]?.maskedKey?.length).toBeLessThanOrEqual(12);
  });

  it("masks a short key fully in the client DTO", () => {
    const yaml = `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: \${SHORT_KEY}
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`;

    const dto = toClientConfig(parseConfig(yaml, { env: { SHORT_KEY: "abc" } }));

    expect(dto.services[0]?.maskedKey).toBe("••••••••");
    expect(JSON.stringify(dto)).not.toContain("abc");
  });

  it("only reveals the last four characters at 12 characters or more via the DTO", () => {
    const yaml = `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: \${TEST_KEY}
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`;

    for (const [secret, masked] of [
      ["1234567", "••••••••"],
      ["12345678", "••••••••"],
      ["12345678901", "••••••••"],
      ["123456789012", "••••••••9012"],
    ] as const) {
      const dto = toClientConfig(
        parseConfig(yaml, { env: { TEST_KEY: secret } }),
      );
      expect(dto.services[0]?.maskedKey).toBe(masked);
    }
  });

  it("resolves several environment references inside one value", () => {
    const config = parseConfig(
      `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: \${FIRST}-\${SECOND}
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`,
      { env: { FIRST: "one", SECOND: "two" } },
    );

    expect(config.services[0]?.apiKey).toBe("one-two");
  });

  it("leaves a literal dollar sign untouched", () => {
    const config = parseConfig(
      `services:
  - id: radarr
    type: radarr
    url: http://localhost:7878
    api_key: "p$ssword"
ui:
  theme: dark
  language: da
  density: comfortable
widgets: []
`,
      { env: {} },
    );

    expect(config.services[0]?.apiKey).toBe("p$ssword");
  });

  it("keeps resolved secrets out of JSON.stringify while apiKey still works", () => {
    const config = parseConfig(CONFIG_YAML, { env: ENV });
    const serialised = JSON.stringify(config);

    expect(serialised).not.toContain("radarr-api-key-1234");
    expect(serialised).not.toContain("plex-token-abcd");
    expect(config.services[0]?.apiKey).toBe("radarr-api-key-1234");
    expect(config.services[1]?.token).toBe("plex-token-abcd");
  });

  it("throws when config is touched in a browser runtime", () => {
    vi.stubGlobal("window", {});

    expect(() => assertServerRuntime()).toThrow(/server-only/i);
    expect(() => parseConfig(CONFIG_YAML, { env: ENV })).toThrow(
      /server-only/i,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
