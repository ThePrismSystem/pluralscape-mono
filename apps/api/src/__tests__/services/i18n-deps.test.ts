import { afterEach, describe, expect, it, vi } from "vitest";

import type { ValkeyClient } from "../../middleware/stores/valkey-store.js";

/**
 * The `env` object is frozen by `createEnv` at module-load time, so
 * `vi.stubEnv` alone cannot influence `getI18nDeps()` once the service
 * module is imported. Mocking the env module with a hoisted mutable record
 * lets each test pin the frozen-env side. The production gate now lives in
 * `assertInMemoryCacheAllowed`, which reads `process.env` directly — so
 * tests also stub process.env via `vi.stubEnv` to keep both surfaces in
 * sync before dynamically importing the service under test.
 */
const { mockEnv, mockGetShared } = vi.hoisted(() => ({
  mockEnv: {
    NODE_ENV: "test" as "development" | "test" | "production",
    LOG_LEVEL: "info" as const,
    TRUST_PROXY: false,
    DISABLE_RATE_LIMIT: false,
    ALLOW_IN_MEMORY_CACHE: undefined as "0" | "1" | undefined,
    CROWDIN_DISTRIBUTION_HASH: "hash" as string | undefined,
    CROWDIN_OTA_BASE_URL: "https://distributions.crowdin.net",
  },
  mockGetShared: vi.fn<() => ValkeyClient | undefined>(),
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));
vi.mock("../../middleware/rate-limit.js", () => ({
  getSharedValkeyClient: mockGetShared,
}));

describe("getI18nDeps — production in-memory guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockGetShared.mockReset();
    mockEnv.NODE_ENV = "test";
    mockEnv.ALLOW_IN_MEMORY_CACHE = undefined;
    mockEnv.CROWDIN_DISTRIBUTION_HASH = "hash";
  });

  it("throws in NODE_ENV=production when VALKEY_URL is unset and opt-in flag is absent", async () => {
    // The production gate lives in assertInMemoryCacheAllowed, which reads
    // process.env directly so wiring code without access to the hoisted mock
    // env object can still apply it. Stub both surfaces so the service
    // module and the helper agree on NODE_ENV under test.
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOW_IN_MEMORY_CACHE = undefined;
    mockEnv.CROWDIN_DISTRIBUTION_HASH = "hash";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "");
    mockGetShared.mockReturnValue(undefined);

    const { getI18nDeps, _resetI18nDepsForTesting } = await import("../../services/i18n-deps.js");
    _resetI18nDepsForTesting();

    expect(() => getI18nDeps()).toThrow(/ALLOW_IN_MEMORY_CACHE=1/);
  });

  it("allows fallback in NODE_ENV=production when ALLOW_IN_MEMORY_CACHE=1", async () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOW_IN_MEMORY_CACHE = "1";
    mockEnv.CROWDIN_DISTRIBUTION_HASH = "hash";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "1");
    mockGetShared.mockReturnValue(undefined);

    const { getI18nDeps, _resetI18nDepsForTesting } = await import("../../services/i18n-deps.js");
    _resetI18nDepsForTesting();

    const deps = getI18nDeps();
    expect(deps).not.toBeNull();
  });

  it("does not throw in non-production even when VALKEY_URL is unset and opt-in is absent", async () => {
    mockEnv.NODE_ENV = "development";
    mockEnv.ALLOW_IN_MEMORY_CACHE = undefined;
    mockEnv.CROWDIN_DISTRIBUTION_HASH = "hash";
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_IN_MEMORY_CACHE", "");
    mockGetShared.mockReturnValue(undefined);

    const { getI18nDeps, _resetI18nDepsForTesting } = await import("../../services/i18n-deps.js");
    _resetI18nDepsForTesting();

    const deps = getI18nDeps();
    expect(deps).not.toBeNull();
  });
});
