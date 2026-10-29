import { expect, test } from "@playwright/test";

test("Light sets the light theme and repaints the page", async ({ page }) => {
  await page.goto("/");

  await page.locator('label:has(input[name="topbar-theme"][value="light"])').click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(245, 246, 248)",
  );
});

test("Compact sets the row height token to 32px", async ({ page }) => {
  await page.goto("/");

  await page.locator('label:has(input[name="topbar-density"][value="compact"])').click();

  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  const rowHeight = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--row-h")
      .trim(),
  );
  expect(rowHeight).toBe("32px");
});

test("System follows prefers-color-scheme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await page.locator('label:has(input[name="topbar-theme"][value="system"])').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Persisted English renders on first paint without a language flip", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "opspulse.ui",
      JSON.stringify({ theme: "light", language: "en", density: "compact" }),
    );

    type ProbeWindow = Window & {
      navLabels?: string[];
      firstLabelAt?: number;
      revealSeen?: boolean;
    };
    const probe = window as ProbeWindow;
    probe.navLabels = [];

    const shellWrapper = () =>
      document.querySelector("header")?.parentElement ?? null;

    const recordVisibleLabel = () => {
      const link = document.querySelector("nav a");
      const wrapper = shellWrapper();
      if (!link || !wrapper || wrapper.hasAttribute("hidden")) return;

      if (probe.firstLabelAt === undefined) {
        probe.firstLabelAt = performance.now();
      }

      const label = link.textContent;
      const seen = probe.navLabels;
      if (label && seen && seen[seen.length - 1] !== label) seen.push(label);
    };

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "attributes" || mutation.attributeName !== "hidden") {
          continue;
        }
        const wrapper = shellWrapper();
        if (mutation.target === wrapper && wrapper && !wrapper.hasAttribute("hidden")) {
          probe.revealSeen = true;
        }
      }

      recordVisibleLabel();
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tilføj tjenester" }),
  ).toHaveCount(0);

  const probe = await page.evaluate(() => {
    const state = window as Window & {
      navLabels?: string[];
      firstLabelAt?: number;
      revealSeen?: boolean;
    };
    return {
      navLabels: state.navLabels,
      firstLabelAt: state.firstLabelAt,
      revealSeen: state.revealSeen,
    };
  });

  expect(probe.revealSeen).toBe(true);
  expect(probe.navLabels).toEqual(["Dashboard"]);
  expect(typeof probe.firstLabelAt).toBe("number");

  await page.waitForFunction(() =>
    performance
      .getEntriesByType("paint")
      .some((entry) => entry.name === "first-contentful-paint"),
  );
  const firstContentfulPaint = await page.evaluate(() => {
    const entry = performance
      .getEntriesByType("paint")
      .find((candidate) => candidate.name === "first-contentful-paint");
    return entry ? entry.startTime : null;
  });
  expect(firstContentfulPaint).not.toBeNull();
  expect(probe.firstLabelAt as number).toBeLessThanOrEqual(
    (firstContentfulPaint as number) + 50,
  );
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("Focus-visible rings are 2px accent outlines with a 2px offset", async ({
  page,
}) => {
  await page.goto("/");

  const ring = {
    width: "2px",
    offset: "2px",
    color: "rgb(76, 141, 255)",
  };

  const search = page.getByRole("searchbox");
  await search.focus();
  await expect(search).toHaveCSS("outline-width", ring.width);
  await expect(search).toHaveCSS("outline-offset", ring.offset);
  await expect(search).toHaveCSS("outline-color", ring.color);

  const link = page.getByRole("link", { name: "Overblik" });
  await link.focus();
  await expect(link).toHaveCSS("outline-width", ring.width);
  await expect(link).toHaveCSS("outline-offset", ring.offset);
  await expect(link).toHaveCSS("outline-color", ring.color);

  const radio = page.getByRole("radio", { name: "Dansk" });
  await radio.focus();
  const segment = page.locator('label:has(input[name="topbar-language"])').first();
  await expect(segment).toHaveCSS("outline-width", ring.width);
  await expect(segment).toHaveCSS("outline-offset", ring.offset);
  await expect(segment).toHaveCSS("outline-color", ring.color);
});

test("Dansk relabels the whole navigation", async ({ page }) => {
  await page.goto("/");

  await page.locator('label:has(input[name="topbar-language"][value="en"])').click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

  await page.locator('label:has(input[name="topbar-language"][value="da"])').click();

  await expect(page.getByRole("link", { name: "Overblik" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Historik" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tilføj tjenester" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Indstillinger" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
});
