import path from "node:path";
import { defineConfig } from "vitest/config";

const PACKAGES = [
  "types",
  "db",
  "crypto",
  "sync",
  "api-client",
  "data",
  "queue",
  "storage",
  "validation",
  "rotation-worker",
  "email",
];

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

function integrationProjectConfig(name: string, root: string) {
  return {
    test: {
      name: `${name}-integration`,
      root,
      environment: "node",
      include: ["src/**/*.integration.{test,spec}.ts"],
      globals: false,
      restoreMocks: true,
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  };
}

export default defineConfig({
  test: {
    projects: [
      ...PACKAGES.map((name) => projectConfig(name, `packages/${name}`)),
      ...PACKAGES.map((name) => integrationProjectConfig(name, `packages/${name}`)),
      projectConfig("api", "apps/api"),
      integrationProjectConfig("api", "apps/api"),
      {
        test: {
          name: "scripts",
          root: "scripts",
          environment: "node",
          include: ["__tests__/**/*.{test,spec}.ts"],
          globals: false,
          restoreMocks: true,
          testTimeout: 5000,
          hookTimeout: 10000,
        },
      },
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
      {
        resolve: {
          alias: {
            // react-native uses Flow types and cannot be parsed by rolldown/esbuild
            // in a Node/vitest environment. Redirect to a minimal stub so tests
            // that transitively import react-native (e.g. via expo-constants) work.
            "react-native": path.resolve("apps/mobile/src/__tests__/react-native-mock.ts"),
            // Expo native modules — redirect to in-memory mocks so wrapper logic
            // (key namespacing, error wrapping, init guards, fallbacks) is testable
            // without spinning up a real device or simulator.
            "expo-secure-store": path.resolve(
              "apps/mobile/src/__tests__/expo-secure-store-mock.ts",
            ),
            "expo-sqlite": path.resolve("apps/mobile/src/__tests__/expo-sqlite-mock.ts"),
            "expo-constants": path.resolve("apps/mobile/src/__tests__/expo-constants-mock.ts"),
          },
        },
        test: {
          name: "mobile",
          root: "apps/mobile",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}", "app/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["**/*.integration.{test,spec}.ts"],
          globals: false,
          restoreMocks: true,
          testTimeout: 10000,
          hookTimeout: 10000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/api/src/**/*.ts", "apps/mobile/src/**/*.{ts,tsx}"],
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
        "packages/types/src/api-keys.ts",
        "packages/types/src/audit-log.ts",
        "packages/types/src/blob.ts",
        "packages/types/src/image-source.ts",
        "packages/types/src/import-export.ts",
        "packages/types/src/jobs.ts",
        "packages/types/src/logger.ts",
        "packages/types/src/notifications.ts",
        "packages/types/src/pk-bridge.ts",
        "packages/types/src/realtime.ts",
        "packages/types/src/search.ts",
        "packages/types/src/snapshot.ts",
        "packages/types/src/webhooks.ts",
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

        // storage: interface-only files (no executable code)
        "packages/storage/src/interface.ts",
        // sync: CRDT schema interfaces and adapter interfaces (no executable code)
        "packages/sync/src/schemas.ts",
        "packages/sync/src/schemas/**/*.ts",
        "packages/sync/src/adapters.ts",
        "packages/sync/src/adapters/network-adapter.ts",
        "packages/sync/src/adapters/offline-queue-adapter.ts",
        "packages/sync/src/adapters/storage-adapter.ts",
        "packages/sync/src/conflict-persistence.ts",
        "packages/sync/src/relay-service.ts",
        // rotation-worker: interface-only file
        "packages/rotation-worker/src/types.ts",
        // email: interface-only and type-only files (no executable code)
        "packages/email/src/interface.ts",
        "packages/email/src/templates/types.ts",
        // mobile: type-only files
        "apps/mobile/src/auth/auth-types.ts",
        "apps/mobile/src/platform/types.ts",
        // mobile: Expo-native drivers — require native modules, produce 0% in Node/vitest
        "apps/mobile/src/platform/drivers/expo-sqlite-driver.ts",
        // mobile: config depends on expo-constants — mocked in tests but not coverable
        "apps/mobile/src/config.ts",
      ],
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      // packages/db has only integration tests currently; unit coverage
      // will be enforced when db schema code (db-2je4) is added
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
