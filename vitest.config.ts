import { defineConfig } from "vitest/config";

const PACKAGES = ["types", "db", "crypto", "sync", "api-client"];

function projectConfig(name: string, root: string) {
  return {
    test: {
      name,
      root,
      environment: "node",
      include: ["src/**/*.{test,spec}.ts"],
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
