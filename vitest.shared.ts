import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
