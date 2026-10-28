import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokens = readFileSync(join(root, "design/tokens.css"), "utf8");
const globals = readFileSync(join(root, "app/globals.css"), "utf8");

const requiredTokens = [
  "--bg",
  "--surface",
  "--accent",
  "--ok",
  "--warn",
  "--danger",
  "--stale",
  "--viz-seq-7",
  "--viz-cat-6",
  "--row-h",
  "--font-mono",
  "--border-soft",
];

function slice(start: string, end: string): string {
  const from = tokens.indexOf(start);
  const to = tokens.indexOf(end, from + start.length);
  expect(from, start).toBeGreaterThanOrEqual(0);
  expect(to, end).toBeGreaterThan(from);
  return tokens.slice(from, to);
}

describe("design tokens", () => {
  it("defines every mandatory token", () => {
    for (const token of requiredTokens) {
      expect(tokens, token).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("uses tokens.css as the drift authority for the colour table", () => {
    const dark = slice('[data-theme="dark"]', '[data-theme="light"]');
    const light = slice('[data-theme="light"]', '[data-density="comfortable"]');

    expect(dark).toMatch(/--faint:\s*#7d858d/);
    expect(light).toMatch(/--muted:\s*#616870/);
    expect(light).toMatch(/--faint:\s*#656d75/);
  });

  it("maps the token set into Tailwind v4 exactly once", () => {
    const imports = globals.match(/@import\s+"\.\.\/design\/tokens\.css"/g) ?? [];
    expect(imports).toHaveLength(1);
    expect(globals).toContain("@theme inline");

    const mapped = [
      "--color-bg",
      "--color-surface",
      "--color-surface-2",
      "--color-surface-3",
      "--color-surface-inset",
      "--color-fg",
      "--color-fg-2",
      "--color-muted",
      "--color-faint",
      "--color-border",
      "--color-border-strong",
      "--color-border-accent",
      "--color-accent",
      "--color-accent-soft",
      "--color-accent-line",
      "--color-ok",
      "--color-ok-soft",
      "--color-warn",
      "--color-warn-soft",
      "--color-danger",
      "--color-danger-soft",
      "--color-stale",
      "--color-stale-soft",
      "--color-viz-seq-1",
      "--color-viz-seq-7",
      "--color-viz-cat-1",
      "--color-viz-cat-6",
      "--font-ui",
      "--font-mono",
      "--text-11",
      "--text-15",
      "--text-36",
      "--leading-tight",
      "--leading-snug",
      "--leading-body",
      "--tracking-display",
      "--tracking-tight",
      "--tracking-label",
      "--shadow-1",
      "--spacing-row",
      "--spacing-cell-y",
      "--spacing-cell-x",
      "--spacing-feed-y",
      "--transition-duration-1",
      "--transition-duration-5",
      "--ease-out",
      "--ease-inout",
      "--z-index-sticky",
      "--z-index-dropdown",
      "--z-index-overlay",
      "--z-index-toast",
      "--breakpoint-xs",
      "--breakpoint-2xl",
      "--animate-feed-in",
      "--animate-toast-in",
    ];

    for (const name of mapped) {
      expect(globals, name).toMatch(new RegExp(`${name}\\s*:`));
    }

    // v4 namespaces: utilities are generated from these names, so a typo or a
    // dropped block would silently remove z-toast/duration-* from the build.
    expect(globals).toMatch(/--z-index-toast:\s*var\(--z-toast\)/);
    expect(globals).toMatch(/--transition-duration-3:\s*var\(--dur-3\)/);
  });
});
