import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceDirs = [
  join(root, "app"),
  join(root, "components"),
  join(root, "lib"),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = sourceDirs.flatMap(walk).filter((path) => /\.(ts|tsx)$/.test(path));

const rawHex = /#[0-9a-fA-F]{3,8}\b/;
const rawRgb = /rgb\(/i;

describe("component colours", () => {
  it("never hardcodes a colour outside design/tokens.css", () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const reasons: string[] = [];
      if (rawHex.test(source)) reasons.push("hex colour");
      if (rawRgb.test(source)) reasons.push("rgb() colour");
      return reasons.map(
        (reason) => `${relative(root, file)}: ${reason}`,
      );
    });

    expect(offenders).toEqual([]);
  });
});
