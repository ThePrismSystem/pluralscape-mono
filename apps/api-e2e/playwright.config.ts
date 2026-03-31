import { defineConfig } from "@playwright/test";

/** E2E test port — deliberately different from the dev server default (10045). */
const E2E_PORT = 10_099;

/** Worker count: explicit env override > CI default (2) > local default (4). */
const CI_WORKERS = 2;
const LOCAL_WORKERS = 4;
const E2E_WORKERS =
  Number(process.env.E2E_WORKERS) || (process.env.CI ? CI_WORKERS : LOCAL_WORKERS);

export default defineConfig({
  fullyParallel: false,
  workers: E2E_WORKERS,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${String(E2E_PORT)}`,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  projects: [
    { name: "api", testDir: "src/tests", testMatch: "**/*.spec.ts" },
    { name: "api-slow", testDir: "src/tests-slow", testMatch: "**/*.spec.ts" },
  ],
  globalSetup: "src/global-setup.ts",
  globalTeardown: "src/global-teardown.ts",
});
