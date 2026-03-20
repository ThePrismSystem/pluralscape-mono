import { toCursor } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { MemberResult } from "../../../services/member.service.js";
import type { ApiErrorResponse, PaginatedResult } from "@pluralscape/types";

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

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listMembers } = await import("../../../services/member.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

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

  it("passes includeArchived=true to service", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/members?includeArchived=true`);

    expect(vi.mocked(listMembers)).toHaveBeenCalledWith(expect.anything(), SYS_ID, MOCK_AUTH, {
      cursor: undefined,
      limit: 25,
      includeArchived: true,
    });
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("returns 400 for invalid includeArchived value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members?includeArchived=yes`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members`);

    expect(res.status).toBe(500);
  });

  // ── Sparse fieldset tests ──────────────────────────────────────

  it("returns only requested fields when ?fields= is valid", async () => {
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
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    };
    vi.mocked(listMembers).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members?fields=id,version`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<Partial<MemberResult>>;
    expect(body.items[0]).toEqual({
      id: "mem_550e8400-e29b-41d4-a716-446655440000",
      version: 1,
    });
    expect(body.items[0]).not.toHaveProperty("encryptedData");
  });

  it("returns 400 for invalid field name in ?fields=", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members?fields=id,badField`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns full response when ?fields= is empty", async () => {
    vi.mocked(listMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members?fields=`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<MemberResult>;
    expect(body.items).toEqual([]);
  });
});
