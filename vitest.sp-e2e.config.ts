import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "sp-e2e",
    root: "packages/import-sp",
    environment: "node",
    include: ["src/__tests__/e2e/**/*.e2e.{test,spec}.ts"],
    globals: false,
    restoreMocks: true,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
