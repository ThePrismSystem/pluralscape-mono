import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/api"],
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
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
