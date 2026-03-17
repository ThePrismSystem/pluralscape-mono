import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemProfileResult } from "../../../services/system.service.js";
import type { PaginatedResult } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  listSystems: vi.fn(),
  getSystemProfile: vi.fn(),
  updateSystemProfile: vi.fn(),
  archiveSystem: vi.fn(),
  createSystem: vi.fn(),
}));

vi.mock("../../../lib/request-meta.js", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
  extractIpAddress: vi.fn().mockReturnValue(null),
  extractUserAgent: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { listSystems } = await import("../../../services/system.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const EMPTY_PAGE: PaginatedResult<SystemProfileResult> = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems", () => {
  beforeEach(() => {
    vi.mocked(listSystems).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no systems exist", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request("/systems");

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<SystemProfileResult>;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.totalCount).toBeNull();
  });

  it("returns 200 with paginated systems", async () => {
    const page: PaginatedResult<SystemProfileResult> = {
      items: [
        {
          id: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
          encryptedData: null,
          version: 1,
          createdAt: 1000 as never,
          updatedAt: 1000 as never,
        },
      ],
      nextCursor: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listSystems).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request("/systems?limit=1");

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<SystemProfileResult>;
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBeTruthy();
  });

  it("forwards accountId, cursor, and limit to service", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?cursor=sys_abc&limit=10");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      "sys_abc",
      10,
    );
  });

  it("passes undefined cursor and limit when not provided", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      undefined,
    );
  });

  it("caps limit to MAX_SYSTEM_LIMIT", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?limit=999");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      100,
    );
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listSystems).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems");

    expect(res.status).toBe(500);
  });
});
