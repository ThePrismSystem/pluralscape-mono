import { afterEach, describe, expect, it, vi } from "vitest";

import {
  _resetSharedValkeyClientForTesting,
  getSharedValkeyClient,
  setSharedValkeyClient,
} from "../../middleware/rate-limit.js";

import type { ValkeyClient } from "../../middleware/stores/valkey-store.js";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
  DISABLE_RATE_LIMIT: false,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

describe("shared valkey client slot", () => {
  afterEach(() => {
    _resetSharedValkeyClientForTesting();
  });

  it("returns undefined before any client is registered", () => {
    expect(getSharedValkeyClient()).toBeUndefined();
  });

  it("round-trips a registered client", () => {
    const client: ValkeyClient = {
      eval: vi.fn(),
      ping: vi.fn(),
      disconnect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };
    setSharedValkeyClient(client);
    expect(getSharedValkeyClient()).toBe(client);
  });

  it("reset helper clears the registered client", () => {
    const client: ValkeyClient = {
      eval: vi.fn(),
      ping: vi.fn(),
      disconnect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };
    setSharedValkeyClient(client);
    _resetSharedValkeyClientForTesting();
    expect(getSharedValkeyClient()).toBeUndefined();
  });
});
