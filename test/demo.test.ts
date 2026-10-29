// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createDemoSnapshot,
  demoContainers,
  demoDisk,
  demoDiskHistory,
  demoErrors,
  demoFeed,
  demoQueue,
  demoStreams,
  posterFor,
} from "@/lib/connectors/demo";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("deterministic demo data", () => {
  it("produces the same snapshot hash on every call", () => {
    const first = createDemoSnapshot();
    const second = createDemoSnapshot();

    expect(hash(first)).toBe(hash(second));
  });

  it("keeps the same hash across two module imports in the same process", async () => {
    const first = createDemoSnapshot();
    vi.resetModules();
    const fresh = await import("@/lib/connectors/demo");
    const second = fresh.createDemoSnapshot();

    expect(hash(first)).toBe(hash(second));
  });

  it("generates exactly 12,480 queue rows", () => {
    expect(demoQueue()).toHaveLength(12_480);
  });

  it("generates 8 feed events, 3 streams, 12 containers, 24 disk samples and 4 errors", () => {
    expect(demoFeed()).toHaveLength(8);
    expect(demoStreams()).toHaveLength(3);
    expect(demoContainers()).toHaveLength(12);
    expect(demoDiskHistory()).toHaveLength(24);
    expect(demoErrors()).toHaveLength(4);
  });

  it("has exactly one transcoding stream at 68 % CPU", () => {
    const streams = demoStreams();
    const transcodes = streams.filter((stream) => stream.mode === "transcode");

    expect(transcodes).toHaveLength(1);
    expect(transcodes[0]?.cpuPercent).toBe(68);
  });

  it("has 11 running containers and one restarting container", () => {
    const containers = demoContainers();

    expect(containers.filter((container) => container.state === "up")).toHaveLength(
      11,
    );
    expect(
      containers.filter((container) => container.state === "restarting"),
    ).toHaveLength(1);
  });

  it("spaces disk samples one hour apart, newest last", () => {
    const samples = demoDiskHistory();
    const hours = samples.map((sample) => new Date(sample.at).getTime());

    for (let index = 1; index < hours.length; index += 1) {
      expect(hours[index]! - hours[index - 1]!).toBe(60 * 60 * 1000);
    }
    expect(demoDisk()?.at).toBe(samples.at(-1)?.at);
    expect(demoDisk()?.history).toHaveLength(24);
  });

  it("has one error, two warnings and one info entry", () => {
    const errors = demoErrors();

    expect(errors.filter((entry) => entry.severity === "error")).toHaveLength(1);
    expect(errors.filter((entry) => entry.severity === "warning")).toHaveLength(
      2,
    );
    expect(errors.filter((entry) => entry.severity === "info")).toHaveLength(1);
  });

  it("uses generated SVG data URIs instead of external artwork", () => {
    const posters = [
      ...demoStreams().map((stream) => stream.poster),
      ...demoFeed().map((event) => event.poster),
    ];

    expect(posters.length).toBeGreaterThan(0);
    for (const poster of posters) {
      expect(poster).toMatch(/^data:image\/svg\+xml(;base64)?,/);
      expect(poster).not.toContain("http://");
      expect(poster).not.toContain("https://");
    }
  });

  it("generates posters without relying on Node's Buffer global", () => {
    const original = (globalThis as { Buffer?: unknown }).Buffer;
    (globalThis as { Buffer?: unknown }).Buffer = undefined;

    try {
      expect(posterFor("Dune: Part Two")).toMatch(
        /^data:image\/svg\+xml,/,
      );
    } finally {
      (globalThis as { Buffer?: unknown }).Buffer = original;
    }
  });

  it("keeps queue progress normalised between 0 and 1", () => {
    for (const item of demoQueue()) {
      expect(item.progress).toBeGreaterThanOrEqual(0);
      expect(item.progress).toBeLessThanOrEqual(1);
    }
  });
});
