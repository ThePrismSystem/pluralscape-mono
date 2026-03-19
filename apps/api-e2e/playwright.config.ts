import { defineConfig } from "@playwright/test";

/** E2E test port — deliberately different from the dev server default (10045). */
const E2E_PORT = 10_099;

export default defineConfig({
  testDir: "src/tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${String(E2E_PORT)}`,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  projects: [{ name: "api", testMatch: "**/*.spec.ts" }],
  globalSetup: "src/global-setup.ts",
  globalTeardown: "src/global-teardown.ts",
});
