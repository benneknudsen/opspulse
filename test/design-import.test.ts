import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const designDir = join(root, "design");
const publicDir = join(root, "public");

const contractFiles = [
  "README.md",
  "components.md",
  "tokens.css",
  "tailwind.config.ts",
  "copy.en.json",
  "copy.da.json",
  "reference/vision.html",
  "reference/vision.html.artifact.json",
  "reference/.build-qa.py",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("design handoff import", () => {
  it("contains every contract file", () => {
    for (const file of contractFiles) {
      expect(existsSync(join(designDir, file)), file).toBe(true);
    }
  });

  it("ships all 16 brand marks", () => {
    const icons = readdirSync(join(designDir, "assets/icons"));
    expect(icons).toHaveLength(16);
    expect(readdirSync(join(publicDir, "brands"))).toHaveLength(16);
  });

  it("mirrors every brand mark byte for byte into public/brands", () => {
    const icons = readdirSync(join(designDir, "assets/icons")).sort();
    const brands = readdirSync(join(publicDir, "brands")).sort();

    expect(brands).toEqual(icons);
    for (const name of icons) {
      expect(
        readFileSync(join(publicDir, "brands", name)),
        `public/brands/${name}`,
      ).toEqual(readFileSync(join(designDir, "assets/icons", name)));
    }
  });

  it("does not import non-free posters", () => {
    expect(existsSync(join(designDir, "assets/posters"))).toBe(false);
  });

  it("keeps poster paths out of every non-frozen file", () => {
    // The frozen handoff itself names the posters: the board references them
    // and the spec documents why they are absent. Everything else — and all
    // of public/ — must stay clean.
    const frozen = new Set([
      "design/README.md",
      "design/README-IN-REPO.md",
      "design/reference/vision.html",
    ]);

    const offenders = walk(designDir)
      .concat(walk(publicDir))
      .map((path) => relative(root, path))
      .filter((path) => !frozen.has(path))
      .filter((path) => readFileSync(join(root, path), "utf8").includes("posters/"));

    expect(offenders).toEqual([]);
  });

  it("records checksums that match the files on disk", () => {
    const lines = readFileSync(join(designDir, ".checksums"), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "");

    for (const line of lines) {
      const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
      const expected = match?.[1];
      const file = match?.[2];
      if (!expected || !file) {
        throw new Error(`Malformed checksum line: ${line}`);
      }
      expect(sha256(join(designDir, file)), file).toBe(expected);
    }

    const recorded = lines.map((line) => line.split(/\s+/)[1] ?? "");
    for (const file of contractFiles.filter((name) => /\.(md|css|json|ts)$/.test(name))) {
      expect(recorded, file).toContain(`./${file}`);
    }

    for (const name of readdirSync(join(designDir, "assets/icons"))) {
      expect(recorded, name).toContain(`./assets/icons/${name}`);
    }
  });
});
