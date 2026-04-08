// apps/mobile/src/__tests__/expo-constants-mock.ts
//
// Mock of expo-constants for vitest.
// Tests can override the config object via __setConfig() to drive the
// fallback branches in apps/mobile/src/config.ts (missing apiUrl, missing
// extras, dev vs prod, etc.).

export type MockExpoConfig = {
  extra?: Record<string, unknown>;
  hostUri?: string;
  name?: string;
  slug?: string;
  version?: string;
} | null;

export type MockExecutionEnvironment = "standalone" | "storeClient" | "bare";

const defaultConfig: MockExpoConfig = {
  extra: {},
  hostUri: "127.0.0.1:8081",
  name: "Pluralscape",
  slug: "pluralscape",
  version: "0.0.0",
};

let currentConfig: MockExpoConfig = defaultConfig;
let executionEnvironment: MockExecutionEnvironment = "bare";

const Constants = {
  get expoConfig(): MockExpoConfig {
    return currentConfig;
  },
  get manifest(): MockExpoConfig {
    return currentConfig;
  },
  get manifest2(): MockExpoConfig {
    return currentConfig;
  },
  get executionEnvironment(): string {
    return executionEnvironment;
  },
};

// Test helpers — not part of the real expo-constants API.
export function __setConfig(config: MockExpoConfig): void {
  currentConfig = config;
}

export function __setExecutionEnvironment(env: MockExecutionEnvironment): void {
  executionEnvironment = env;
}

export function __reset(): void {
  currentConfig = defaultConfig;
  executionEnvironment = "bare";
}

export default Constants;
