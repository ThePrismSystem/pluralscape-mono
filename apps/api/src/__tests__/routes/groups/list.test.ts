import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toCursor } from "../../../lib/pagination.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { GroupResult } from "../../../services/group/queries.js";
import type { ApiErrorResponse, PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group/queries.js", () => ({
  listGroups: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { listGroups } = await import("../../../services/group/queries.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups";
const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

describe("GET /systems/:id/groups", () => {
  beforeEach(() => {
    vi.mocked(listGroups).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listGroups).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(SYS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });

  it("forwards systemId, auth, cursor, and limit to service", async () => {
    vi.mocked(listGroups).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`${SYS_URL}?cursor=${toCursor("grp_abc")}&limit=10`);

    expect(vi.mocked(listGroups)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      MOCK_AUTH,
      "grp_abc",
      10,
      false,
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listGroups).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(SYS_URL);

    expect(res.status).toBe(500);
  });

  // ── Sparse fieldset tests ──────────────────────────────────────

  it("returns only requested fields when ?fields= is valid", async () => {
    const page: PaginatedResult<GroupResult> = {
      data: [
        {
          id: "grp_550e8400-e29b-41d4-a716-446655440000" as never,
          systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
          parentGroupId: null,
          sortOrder: 0,
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
    vi.mocked(listGroups).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(`${SYS_URL}?fields=id,version`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<Partial<GroupResult>>;
    expect(body.data[0]).toEqual({ id: "grp_550e8400-e29b-41d4-a716-446655440000", version: 1 });
    expect(body.data[0]).not.toHaveProperty("sortOrder");
  });

  it("returns 400 for invalid field name in ?fields=", async () => {
    const app = createApp();
    const res = await app.request(`${SYS_URL}?fields=id,badField`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns full response when ?fields= is empty", async () => {
    vi.mocked(listGroups).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`${SYS_URL}?fields=`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });
});
