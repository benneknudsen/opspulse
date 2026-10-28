import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  use: {
    baseURL,
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
  },
});
