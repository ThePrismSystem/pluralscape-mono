import { defineConfig } from "vitest/config";

const PACKAGES = ["types", "db", "crypto", "sync", "api-client", "queue", "storage"];

function projectConfig(name: string, root: string) {
  return {
    test: {
      name,
      root,
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
      exclude: ["**/*.integration.{test,spec}.ts"],
      globals: false,
      restoreMocks: true,
      testTimeout: 5000,
      hookTimeout: 10000,
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      ...PACKAGES.map((name) => projectConfig(name, `packages/${name}`)),
      projectConfig("api", "apps/api"),
      {
        test: {
          name: "i18n",
          root: "packages/i18n",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["**/*.integration.{test,spec}.ts"],
          globals: false,
          restoreMocks: true,
          testTimeout: 5000,
          hookTimeout: 10000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/api/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.integration.test.ts",
        "**/*.integration.spec.ts",
        "**/__tests__/**",
        "**/test/**",
        "**/*.d.ts",
        "**/index.ts",
        // Type-only files (no executable code — validated via expectTypeOf tests)
        "packages/types/src/auth.ts",
        "packages/types/src/encryption.ts",
        "packages/types/src/fronting.ts",
        "packages/types/src/groups.ts",
        "packages/types/src/identity.ts",
        "packages/types/src/pagination.ts",
        "packages/types/src/privacy.ts",
        "packages/types/src/results.ts",
        "packages/types/src/structure.ts",
        "packages/types/src/sync.ts",
        "packages/types/src/i18n.ts",
        "packages/types/src/littles-safe-mode.ts",
        "packages/types/src/settings.ts",
        "packages/types/src/timestamps.ts",
        "packages/types/src/utility.ts",
        "packages/types/src/analytics.ts",
        "packages/types/src/communication.ts",
        "packages/types/src/custom-fields.ts",
        "packages/types/src/innerworld.ts",
        "packages/types/src/journal.ts",
        "packages/types/src/lifecycle.ts",
        "packages/types/src/timer.ts",
        "packages/types/src/key-rotation.ts",
        "packages/crypto/src/types.ts",
        "packages/crypto/src/adapter/interface.ts",
        "packages/crypto/src/lifecycle-types.ts",
        "packages/db/src/client/types.ts",
        // Drizzle schema files are declarative — callbacks only run during migration generation
        "packages/db/src/schema/**/*.ts",
        // DB query helpers are tested via integration tests, not unit tests
        "packages/db/src/queries/**/*.ts",
        // queue: interface-only files (no executable code)
        "packages/queue/src/types.ts",
        "packages/queue/src/event-hooks.ts",
        "packages/queue/src/heartbeat.ts",
        "packages/queue/src/job-queue.ts",
        "packages/queue/src/job-worker.ts",
        // queue: BullMQ adapter requires live Valkey — tested via integration tests
        "packages/queue/src/adapters/bullmq/**/*.ts",
        // storage: interface-only files (no executable code)
        "packages/storage/src/interface.ts",
      ],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      // packages/db has only integration tests currently; unit coverage
      // will be enforced when db schema code (db-2je4) is added
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
