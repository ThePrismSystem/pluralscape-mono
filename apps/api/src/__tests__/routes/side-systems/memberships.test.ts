import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/structure-membership.service.js", () => ({
  addSideSystemMembership: vi.fn(),
  listSideSystemMemberships: vi.fn(),
  removeSideSystemMembership: vi.fn(),
  // Stubs for other entity types (imported by sibling route files)
  addSubsystemMembership: vi.fn(),
  listSubsystemMemberships: vi.fn(),
  removeSubsystemMembership: vi.fn(),
  addLayerMembership: vi.fn(),
  listLayerMemberships: vi.fn(),
  removeLayerMembership: vi.fn(),
}));

vi.mock("../../../services/side-system.service.js", () => ({
  createSideSystem: vi.fn(),
  listSideSystems: vi.fn(),
  getSideSystem: vi.fn(),
  updateSideSystem: vi.fn(),
  deleteSideSystem: vi.fn(),
  archiveSideSystem: vi.fn(),
  restoreSideSystem: vi.fn(),
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

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
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

const { addSideSystemMembership, listSideSystemMemberships, removeSideSystemMembership } =
  await import("../../../services/structure-membership.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SS_ID = "ss_550e8400-e29b-41d4-a716-446655440001";
const MEMBERSHIP_ID = "ssm_550e8400-e29b-41d4-a716-446655440002";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const BASE_URL = `/systems/${SYS_ID}/side-systems/${SS_ID}/memberships`;

const MOCK_MEMBERSHIP = {
  id: MEMBERSHIP_ID,
  entityId: SS_ID,
  systemId: SYS_ID,
  encryptedData: "dGVzdA==",
  createdAt: 1000,
};

const VALID_BODY = {
  memberId: "mem_550e8400-e29b-41d4-a716-446655440003",
  encryptedData: "dGVzdA==",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/side-systems/:sideSystemId/memberships", () => {
  beforeEach(() => vi.mocked(addSideSystemMembership).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 with new membership and audit written", async () => {
    vi.mocked(addSideSystemMembership).mockResolvedValueOnce(MOCK_MEMBERSHIP);

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(MEMBERSHIP_ID);
    expect(vi.mocked(addSideSystemMembership)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      SS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid body", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /systems/:id/side-systems/:sideSystemId/memberships/:membershipId", () => {
  beforeEach(() => vi.mocked(removeSideSystemMembership).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with ok: true", async () => {
    vi.mocked(removeSideSystemMembership).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${BASE_URL}/${MEMBERSHIP_ID}`, { method: "DELETE" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 404 when membership not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(removeSideSystemMembership).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Membership not found"),
    );

    const app = createApp();
    const res = await app.request(`${BASE_URL}/${MEMBERSHIP_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /systems/:id/side-systems/:sideSystemId/memberships", () => {
  beforeEach(() => vi.mocked(listSideSystemMemberships).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    const page = {
      items: [MOCK_MEMBERSHIP],
      nextCursor: "cursor_next",
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listSideSystemMemberships).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof page;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(MEMBERSHIP_ID);
    expect(body.hasMore).toBe(true);
  });

  it("returns 400 for invalid sideSystemId param format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/side-systems/not-valid/memberships`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
