import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const componentDir = join(root, "components");
const appDir = join(root, "app");

const copyEn = JSON.parse(
  readFileSync(join(root, "design/copy.en.json"), "utf8"),
) as unknown;
const copyDa = JSON.parse(
  readFileSync(join(root, "design/copy.da.json"), "utf8"),
) as unknown;

function flatten(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === "object"
        ? flatten(child, path)
        : [path];
    },
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function hasKey(dictionary: unknown, path: string): boolean {
  let current: unknown = dictionary;

  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return false;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string";
}

const enKeys = new Set(flatten(copyEn));
const daKeys = new Set(flatten(copyDa));

const componentFiles = walk(componentDir).filter((path) =>
  path.endsWith(".tsx"),
);
const appFiles = walk(appDir).filter((path) => /\.(ts|tsx)$/.test(path));

function collectKeys(files: string[], includeLookupTables: boolean): string[] {
  const keys: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /\b(?:t|useT)\(\s*["']([^"']+)["']/g,
    )) {
      const key = match[1];
      if (key) keys.push(key);
    }
    // Keys also appear in lookup tables, e.g. STATUS_TEXT[status] passed to t().
    if (includeLookupTables) {
      for (const match of source.matchAll(
        /["']([a-zA-Z][\w-]*(?:\.[\w-]+)+)["']/g,
      )) {
        const key = match[1];
        if (key) keys.push(key);
      }
    }
  }

  return keys;
}

const usedKeys = new Set([
  ...collectKeys(componentFiles, true),
  ...collectKeys(appFiles, false),
]);

describe("i18n copy", () => {
  it("has identical key sets in English and Danish", () => {
    expect([...enKeys].sort()).toEqual([...daKeys].sort());
  });

  it("defines every key used by the app in both languages", () => {
    expect(usedKeys.size).toBeGreaterThan(0);

    const missing = [...usedKeys]
      .sort()
      .filter((key) => !hasKey(copyEn, key) || !hasKey(copyDa, key));

    expect(missing).toEqual([]);
  });
});
