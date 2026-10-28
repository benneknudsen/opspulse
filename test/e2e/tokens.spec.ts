import { expect, test } from "@playwright/test";

test("tokens reach the browser as computed styles", async ({ page }) => {
  await page.goto("/dev-tokens");

  await expect(page.getByTestId("dev-tokens")).toBeVisible();

  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
  );
  expect(accent).toBe("#4c8dff");

  const surface = page.getByTestId("swatch-bg-surface");
  await expect(surface).toHaveCSS("background-color", "rgb(18, 20, 23)");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("density tokens compile to real utilities", async ({ page }) => {
  await page.goto("/dev-tokens");

  const row = page.getByTestId("density-row");
  const cell = page.getByTestId("density-cell");

  await expect(row).toHaveCSS("height", "44px");
  await expect(cell).toHaveCSS("padding-top", "11px");
  await expect(cell).toHaveCSS("padding-left", "14px");

  await page.evaluate(() => {
    document.documentElement.dataset.density = "compact";
  });

  const rowHeight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--row-h").trim(),
  );
  expect(rowHeight).toBe("32px");

  await expect(row).toHaveCSS("height", "32px");
  await expect(cell).toHaveCSS("padding-top", "5px");
  await expect(cell).toHaveCSS("padding-left", "10px");
});

test("z-index and duration namespaces generate utilities", async ({ page }) => {
  await page.goto("/dev-tokens");

  await expect(page.getByTestId("z-toast")).toHaveCSS("z-index", "400");
  await expect(page.getByTestId("duration-3")).toHaveCSS(
    "transition-duration",
    "0.22s",
  );
});

test("cascade locking tokens keep their values", async ({ page }) => {
  await page.goto("/dev-tokens");

  const root = () =>
    page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        fontUi: styles.getPropertyValue("--font-ui").trim(),
        shadow1: styles.getPropertyValue("--shadow-1").trim(),
        zToast: styles.getPropertyValue("--z-toast").trim(),
        rowH: styles.getPropertyValue("--row-h").trim(),
      };
    });

  const comfortable = await root();
  expect(comfortable.fontUi.startsWith('"IBM Plex Sans"')).toBe(true);
  expect(comfortable.shadow1.length).toBeGreaterThan(0);
  expect(comfortable.shadow1).toContain("px");
  expect(comfortable.zToast).toBe("400");
  expect(comfortable.rowH).toBe("44px");

  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toContain("IBM Plex Sans");

  await page.evaluate(() => {
    document.documentElement.dataset.density = "compact";
  });

  const compact = await root();
  expect(compact.rowH).toBe("32px");
});
