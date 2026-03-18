import { vi } from "vitest";

import { MOCK_AUTH } from "./route-test-setup.js";

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
} {
  return {
    createCategoryRateLimiter: vi
      .fn()
      .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
        await next();
      }),
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
