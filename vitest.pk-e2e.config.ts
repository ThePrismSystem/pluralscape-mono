/**
 * Standalone vitest config for import-pk E2E tests.
 *
 * These tests require bun (for migrations) and Docker (Postgres + MinIO),
 * so they run in the CI E2E job — NOT in the main coverage job.
 *
 * Local:  pnpm test:e2e:pk-import
 * CI:     runs inside the E2E Tests job via the same script
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "import-pk-e2e",
    root: "packages/import-pk",
    environment: "node",
    include: ["src/__tests__/e2e/**/*.e2e.{test,spec}.ts"],
    globalSetup: ["src/__tests__/e2e/global-setup.ts"],
    globals: false,
    restoreMocks: true,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    setupFiles: ["src/__tests__/e2e/setup-env.ts"],
  },
});
