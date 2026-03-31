import { defineConfig } from "@playwright/test";

/** E2E test port — deliberately different from the dev server default (10045). */
const E2E_PORT = 10_099;

/** Configurable worker count for parallelism experiments. */
const E2E_WORKERS = Number(process.env.E2E_WORKERS) || 1;

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
