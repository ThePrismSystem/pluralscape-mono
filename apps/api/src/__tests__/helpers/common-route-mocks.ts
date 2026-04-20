import { vi } from "vitest";

import { MOCK_ACCOUNT_ONLY_AUTH, MOCK_AUTH } from "./route-test-setup.js";

import type { ServerSecret } from "@pluralscape/types";
import type { Context } from "hono";

/** Factory for vi.mock("…/audit-writer.js") — returns a no-op audit writer. */
export function mockAuditWriterFactory(): { createAuditWriter: ReturnType<typeof vi.fn> } {
  return { createAuditWriter: vi.fn().mockReturnValue(vi.fn()) };
}

/** Factory for vi.mock("…/db.js") — returns an empty object as DB. */
export function mockDbFactory(): { getDb: ReturnType<typeof vi.fn> } {
  return { getDb: vi.fn().mockResolvedValue({}) };
}

/** Factory for vi.mock("…/rate-limit.js") — passes through to next(). */
export function mockRateLimitFactory(): {
  createCategoryRateLimiter: ReturnType<typeof vi.fn>;
  createRateLimiter: ReturnType<typeof vi.fn>;
} {
  const passthrough = vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    });
  return {
    createCategoryRateLimiter: passthrough,
    createRateLimiter: passthrough,
  };
}

/** Factory for vi.mock("…/auth.js") — sets MOCK_AUTH on the context. */
export function mockAuthFactory(): { authMiddleware: ReturnType<typeof vi.fn> } {
  return {
    authMiddleware: vi
      .fn()
      .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
        c.set("auth", MOCK_AUTH);
        await next();
      }),
  };
}

/** Factory for vi.mock("…/auth.js") — sets MOCK_ACCOUNT_ONLY_AUTH (systemId: null). */
export function mockAccountOnlyAuthFactory(): { authMiddleware: ReturnType<typeof vi.fn> } {
  return {
    authMiddleware: vi
      .fn()
      .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
        c.set("auth", MOCK_ACCOUNT_ONLY_AUTH);
        await next();
      }),
  };
}

/** Factory for vi.mock("…/system-ownership.js") — no-op ownership check. */
export function mockSystemOwnershipFactory(): { assertSystemOwnership: ReturnType<typeof vi.fn> } {
  return { assertSystemOwnership: vi.fn() };
}

/** Factory for vi.mock("…/api-key.service.js") — returns all CRUD functions as mocks. */
export function mockApiKeyServiceFactory(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    createApiKey: vi.fn(),
    listApiKeys: vi.fn(),
    getApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
  };
}

/**
 * Factory for vi.mock("…/webhook-config.service.js") — returns all CRUD
 * functions as mocks plus a pass-through `toServerSecret` helper. The
 * helper is a real function because tests rely on it to brand fixture
 * bytes as `ServerSecret` without an `as unknown as` double-cast.
 */
export function mockWebhookConfigServiceFactory(): Record<
  string,
  ReturnType<typeof vi.fn> | ((bytes: Uint8Array) => ServerSecret)
> {
  return {
    createWebhookConfig: vi.fn(),
    listWebhookConfigs: vi.fn(),
    getWebhookConfig: vi.fn(),
    updateWebhookConfig: vi.fn(),
    deleteWebhookConfig: vi.fn(),
    archiveWebhookConfig: vi.fn(),
    restoreWebhookConfig: vi.fn(),
    rotateWebhookSecret: vi.fn(),
    testWebhookConfig: vi.fn(),
    parseWebhookConfigQuery: vi.fn().mockReturnValue({}),
    // Inline cast kept to avoid a circular evaluation: importing the real
    // `toServerSecret` here would be served by the test file's own
    // `vi.mock(...service.js, () => mockWebhookConfigServiceFactory())`
    // before this module finishes loading. Semantically identical to the
    // production helper — update both together if one ever gains runtime
    // validation.
    toServerSecret: (bytes: Uint8Array): ServerSecret => bytes as ServerSecret,
  };
}
