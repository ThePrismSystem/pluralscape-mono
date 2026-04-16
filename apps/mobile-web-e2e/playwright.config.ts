import { defineConfig } from "@playwright/test";

const E2E_PORT = 10_098;
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
    browserName: "chromium",
  },
  projects: [{ name: "mobile-web", testDir: "src/tests", testMatch: "**/*.spec.ts" }],
  globalSetup: "src/global-setup.ts",
  globalTeardown: "src/global-teardown.ts",
});
