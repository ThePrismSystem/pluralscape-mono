import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.js", () => ({
  listAllMemberMemberships: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { listAllMemberMemberships } = await import("../../../services/member.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_660e8400-e29b-41d4-a716-446655440000";
const MEMBERSHIPS_URL = `/systems/${SYS_ID}/members/${MEM_ID}/memberships`;

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/memberships", () => {
  beforeEach(() => {
    vi.mocked(listAllMemberMemberships).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with all memberships", async () => {
    vi.mocked(listAllMemberMemberships).mockResolvedValueOnce({
      groups: [
        {
          groupId: "grp_test" as never,
          memberId: MEM_ID as never,
          systemId: SYS_ID as never,
          createdAt: 1000 as never,
        },
      ],
      structureEntities: [],
    });

    const app = createApp();
    const res = await app.request(MEMBERSHIPS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { groups: { groupId: string }[]; structureEntities: unknown[] };
    };
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0]?.groupId).toBe("grp_test");
    expect(body.data.structureEntities).toEqual([]);
  });

  it("returns 404 when member not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(listAllMemberMemberships).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member not found"),
    );

    const app = createApp();
    const res = await app.request(MEMBERSHIPS_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid member ID format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members/not-a-valid-id/memberships`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/not-a-valid-id/members/${MEM_ID}/memberships`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listAllMemberMemberships).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(MEMBERSHIPS_URL);

    expect(res.status).toBe(500);
  });
});
