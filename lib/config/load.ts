import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { configSchema, type WidgetTuple } from "./schema";
import type { UiPreferences } from "./ui";

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(source ? `${message} (${source})` : message);
    this.name = "ConfigError";
  }
}

/**
 * The resolved config carries real secrets, so it must never be parsed or
 * transformed in the browser.
 */
export function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "OpsPulse config contains server-only secrets and cannot be loaded in the browser.",
    );
  }
}

/**
 * SERVER-ONLY. This is the resolved config and it contains real secrets.
 * It must never be returned from a route handler or a server component.
 */
export interface ResolvedService {
  id: string;
  type: string;
  url: string;
  apiKey?: string;
  token?: string;
}

/**
 * SERVER-ONLY. Keep this object inside the server/connector layer.
 */
export interface LoadedConfig {
  services: ResolvedService[];
  ui: UiPreferences;
  widgets: WidgetTuple[];
}

/**
 * The only config shape that may cross the server-to-client boundary.
 * It deliberately has no api_key, token or apiKey field.
 */
export interface ClientService {
  id: string;
  type: string;
  url: string;
  hasKey: boolean;
  maskedKey: string | null;
}

export interface ClientConfig {
  services: ClientService[];
  ui: UiPreferences;
  widgets: WidgetTuple[];
}

export interface LoadConfigOptions {
  path?: string;
  env?: Record<string, string | undefined>;
}

export interface ParseConfigOptions {
  env?: Record<string, string | undefined>;
  source?: string;
}

const ENV_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const MASK_BULLETS = "\u2022".repeat(8);
const MASK_REVEAL_LENGTH = 12;

export function maskSecret(secret: string): string {
  if (secret.length < MASK_REVEAL_LENGTH) return MASK_BULLETS;
  return `${MASK_BULLETS}${secret.slice(-4)}`;
}

function createResolvedService(
  base: { id: string; type: string; url: string },
  secret?: { field: "apiKey" | "token"; value: string },
): ResolvedService {
  const resolved = { ...base } as ResolvedService;
  Object.defineProperty(resolved, "toJSON", {
    value: () => ({ id: resolved.id, type: resolved.type, url: resolved.url }),
    enumerable: false,
  });
  if (secret) {
    Object.defineProperty(resolved, secret.field, {
      value: secret.value,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
  return resolved;
}

export function resolveEnvironment(
  value: string,
  env: Record<string, string | undefined>,
  location: string,
): string {
  return value.replace(ENV_REFERENCE, (_match, name: string) => {
    const resolved = env[name];
    if (resolved === undefined) {
      throw new ConfigError(
        `Missing environment variable ${name} referenced by ${location}`,
      );
    }
    return resolved;
  });
}

export function parseConfig(
  source: string,
  options: ParseConfigOptions = {},
): LoadedConfig {
  assertServerRuntime();
  const env = options.env ?? process.env;

  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Could not parse YAML: ${message}`, options.source);
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "config";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new ConfigError(`Invalid configuration: ${details}`, options.source);
  }

  const services: ResolvedService[] = parsed.data.services.map(
    (service, index) => {
      const base = {
        id: service.id,
        type: service.type,
        url: service.url,
      };

      if (service.api_key) {
        return createResolvedService(base, {
          field: "apiKey",
          value: resolveEnvironment(
            service.api_key,
            env,
            `services[${index}].api_key`,
          ),
        });
      }
      if (service.token) {
        return createResolvedService(base, {
          field: "token",
          value: resolveEnvironment(
            service.token,
            env,
            `services[${index}].token`,
          ),
        });
      }

      return createResolvedService(base);
    },
  );

  return {
    services,
    ui: parsed.data.ui,
    widgets: parsed.data.widgets,
  };
}

export function loadConfig(
  pathOrOptions: string | LoadConfigOptions = {},
): LoadedConfig {
  assertServerRuntime();
  const options =
    typeof pathOrOptions === "string" ? { path: pathOrOptions } : pathOrOptions;
  const path =
    options.path ??
    process.env.OPSPULSE_CONFIG ??
    resolve(process.cwd(), "opspulse.yaml");
  const env = options.env ?? process.env;

  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Could not read config file: ${message}`, path);
  }

  return parseConfig(source, { env, source: path });
}

export function toClientConfig(config: LoadedConfig): ClientConfig {
  assertServerRuntime();
  return {
    services: config.services.map((service) => {
      const secret = service.apiKey ?? service.token;
      return {
        id: service.id,
        type: service.type,
        url: service.url,
        hasKey: Boolean(secret),
        maskedKey: secret ? maskSecret(secret) : null,
      };
    }),
    ui: { ...config.ui },
    widgets: config.widgets.map(
      ([x, y, w, h]) => [x, y, w, h] as WidgetTuple,
    ),
  };
}
