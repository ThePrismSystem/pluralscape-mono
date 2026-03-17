import { toCursor } from "@pluralscape/types";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { MemberResult } from "../../../services/member.service.js";
import type { PaginatedResult } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.service.js", () => ({
  listMembers: vi.fn(),
  createMember: vi.fn(),
  getMember: vi.fn(),
  updateMember: vi.fn(),
  duplicateMember: vi.fn(),
  archiveMember: vi.fn(),
  restoreMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
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

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
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

const { listMembers } = await import("../../../services/member.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const EMPTY_PAGE: PaginatedResult<MemberResult> = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members", () => {
  beforeEach(() => {
    vi.mocked(listMembers).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no members exist", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<MemberResult>;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("returns 200 with paginated members", async () => {
    const page: PaginatedResult<MemberResult> = {
      items: [
        {
          id: "mem_550e8400-e29b-41d4-a716-446655440000" as never,
          systemId: SYS_ID as never,
          encryptedData: "dGVzdA==",
          version: 1,
          createdAt: 1000 as never,
          updatedAt: 1000 as never,
          archived: false,
          archivedAt: null,
        },
      ],
      nextCursor: "mem_550e8400-e29b-41d4-a716-446655440000" as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listMembers).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members?limit=1`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<MemberResult>;
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
  });

  it("forwards systemId, auth, cursor, and limit to service", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members?cursor=mem_abc&limit=10`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: toCursor("mem_abc"),
      limit: 10,
      includeArchived: false,
    });
  });

  it("passes default limit when not provided", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 25,
      includeArchived: false,
    });
  });

  it("caps limit to MAX_MEMBER_LIMIT", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members?limit=999`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 100,
      includeArchived: false,
    });
  });

  it("falls back to default for NaN limit", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members?limit=abc`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 25,
      includeArchived: false,
    });
  });

  it("passes include_archived=true to service", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members?include_archived=true`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 25,
      includeArchived: true,
    });
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members`);

    expect(res.status).toBe(500);
  });
});
