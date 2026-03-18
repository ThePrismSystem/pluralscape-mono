import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/structure-membership.service.js", () => ({
  addLayerMembership: vi.fn(),
  listLayerMemberships: vi.fn(),
  removeLayerMembership: vi.fn(),
  addSideSystemMembership: vi.fn(),
  listSideSystemMemberships: vi.fn(),
  removeSideSystemMembership: vi.fn(),
  addSubsystemMembership: vi.fn(),
  listSubsystemMemberships: vi.fn(),
  removeSubsystemMembership: vi.fn(),
}));

vi.mock("../../services/layer.service.js", () => ({
  createLayer: vi.fn(),
  listLayers: vi.fn(),
  getLayer: vi.fn(),
  updateLayer: vi.fn(),
  deleteLayer: vi.fn(),
  archiveLayer: vi.fn(),
  restoreLayer: vi.fn(),
}));

vi.mock("../../services/side-system.service.js", () => ({
  createSideSystem: vi.fn(),
  listSideSystems: vi.fn(),
  getSideSystem: vi.fn(),
  updateSideSystem: vi.fn(),
  deleteSideSystem: vi.fn(),
  archiveSideSystem: vi.fn(),
  restoreSideSystem: vi.fn(),
}));

vi.mock("../../services/subsystem.service.js", () => ({
  createSubsystem: vi.fn(),
  listSubsystems: vi.fn(),
  getSubsystem: vi.fn(),
  updateSubsystem: vi.fn(),
  deleteSubsystem: vi.fn(),
  archiveSubsystem: vi.fn(),
  restoreSubsystem: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const service = await import("../../services/structure-membership.service.js");
const { createCategoryRateLimiter } = await import("../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../routes/systems/index.js");
const { ApiHttpError } = await import("../../lib/api-error.js");

// ── Variant definitions ──────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const INVALID_SYS_ID = "not-a-system-id";

interface MembershipVariant {
  label: string;
  urlSegment: string;
  entityId: string;
  membershipId: string;
  invalidMembershipId: string;
  invalidParamSegment: string;
  addFn: keyof typeof service;
  removeFn: keyof typeof service;
  listFn: keyof typeof service;
}

const VARIANTS: MembershipVariant[] = [
  {
    label: "layer",
    urlSegment: "layers",
    entityId: "lyr_550e8400-e29b-41d4-a716-446655440001",
    membershipId: "lyrm_550e8400-e29b-41d4-a716-446655440002",
    invalidMembershipId: "not-a-membership-id",
    invalidParamSegment: "layers/not-valid/memberships",
    addFn: "addLayerMembership",
    removeFn: "removeLayerMembership",
    listFn: "listLayerMemberships",
  },
  {
    label: "side-system",
    urlSegment: "side-systems",
    entityId: "ss_550e8400-e29b-41d4-a716-446655440001",
    membershipId: "ssm_550e8400-e29b-41d4-a716-446655440002",
    invalidMembershipId: "not-a-membership-id",
    invalidParamSegment: "side-systems/not-valid/memberships",
    addFn: "addSideSystemMembership",
    removeFn: "removeSideSystemMembership",
    listFn: "listSideSystemMemberships",
  },
  {
    label: "subsystem",
    urlSegment: "subsystems",
    entityId: "sub_550e8400-e29b-41d4-a716-446655440001",
    membershipId: "subm_550e8400-e29b-41d4-a716-446655440002",
    invalidMembershipId: "not-a-membership-id",
    invalidParamSegment: "subsystems/not-valid/memberships",
    addFn: "addSubsystemMembership",
    removeFn: "removeSubsystemMembership",
    listFn: "listSubsystemMemberships",
  },
];

const VALID_BODY = {
  memberId: "mem_550e8400-e29b-41d4-a716-446655440003",
  encryptedData: "dGVzdA==",
};

// ── Parameterized tests ──────────────────────────────────────────

for (const variant of VARIANTS) {
  const {
    label,
    urlSegment,
    entityId,
    membershipId,
    invalidMembershipId,
    invalidParamSegment,
    addFn,
    removeFn,
    listFn,
  } = variant;
  const baseUrl = `/systems/${SYS_ID}/${urlSegment}/${entityId}/memberships`;

  const mockMembership = {
    id: membershipId,
    entityId,
    systemId: SYS_ID as never,
    encryptedData: "dGVzdA==",
    createdAt: 1000 as never,
  };

  const addMock = () => vi.mocked(service[addFn] as ReturnType<typeof vi.fn>);
  const removeMock = () => vi.mocked(service[removeFn] as ReturnType<typeof vi.fn>);
  const listMock = () => vi.mocked(service[listFn] as ReturnType<typeof vi.fn>);

  const createApp = () => createRouteApp("/systems", systemRoutes);

  describe(`POST /systems/:id/${urlSegment}/:${label}Id/memberships`, () => {
    beforeEach(() => addMock().mockReset());
    afterEach(() => vi.restoreAllMocks());

    it("returns 201 with new membership and audit written", async () => {
      addMock().mockResolvedValueOnce(mockMembership);

      const res = await createApp().request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; entityId: string; encryptedData: string };
      expect(body.id).toBe(membershipId);
      expect(body.entityId).toBe(entityId);
      expect(body.encryptedData).toBe("dGVzdA==");
      expect(addMock()).toHaveBeenCalledWith(
        expect.anything(),
        SYS_ID,
        entityId,
        VALID_BODY,
        MOCK_AUTH,
        expect.any(Function),
      );
    });

    it("returns 400 for malformed JSON body", async () => {
      const res = await createApp().request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty object body", async () => {
      addMock().mockRejectedValueOnce(
        new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
      );

      const res = await createApp().request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid systemId param format", async () => {
      const badUrl = `/systems/${INVALID_SYS_ID}/${urlSegment}/${entityId}/memberships`;
      const res = await createApp().request(badUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 409 when service throws CONFLICT", async () => {
      addMock().mockRejectedValueOnce(new ApiHttpError(409, "CONFLICT", "Duplicate membership"));

      const res = await createApp().request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("CONFLICT");
    });

    it("returns 500 for unexpected errors", async () => {
      addMock().mockRejectedValueOnce(new Error("DB timeout"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const res = await createApp().request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });

      expect(res.status).toBe(500);
    });
  });

  describe(`DELETE /systems/:id/${urlSegment}/:${label}Id/memberships/:membershipId`, () => {
    beforeEach(() => removeMock().mockReset());
    afterEach(() => vi.restoreAllMocks());

    it("returns 204 No Content", async () => {
      removeMock().mockResolvedValueOnce(undefined);

      const res = await createApp().request(`${baseUrl}/${membershipId}`, { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("forwards systemId, membershipId, auth, and audit to service", async () => {
      removeMock().mockResolvedValueOnce(undefined);

      await createApp().request(`${baseUrl}/${membershipId}`, { method: "DELETE" });

      expect(removeMock()).toHaveBeenCalledWith(
        expect.anything(),
        SYS_ID,
        membershipId,
        MOCK_AUTH,
        expect.any(Function),
      );
    });

    it("returns 404 when membership not found", async () => {
      removeMock().mockRejectedValueOnce(
        new ApiHttpError(404, "NOT_FOUND", "Membership not found"),
      );

      const res = await createApp().request(`${baseUrl}/${membershipId}`, { method: "DELETE" });

      expect(res.status).toBe(404);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 for invalid membershipId param format", async () => {
      const res = await createApp().request(`${baseUrl}/${invalidMembershipId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 500 for unexpected errors", async () => {
      removeMock().mockRejectedValueOnce(new Error("Connection lost"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const res = await createApp().request(`${baseUrl}/${membershipId}`, { method: "DELETE" });

      expect(res.status).toBe(500);
    });
  });

  describe(`GET /systems/:id/${urlSegment}/:${label}Id/memberships`, () => {
    beforeEach(() => listMock().mockReset());
    afterEach(() => vi.restoreAllMocks());

    it("returns 200 with paginated list", async () => {
      const page = {
        items: [mockMembership],
        nextCursor: "cursor_next" as never,
        hasMore: true,
        totalCount: null,
      };
      listMock().mockResolvedValueOnce(page);

      const res = await createApp().request(baseUrl);

      expect(res.status).toBe(200);
      const body = (await res.json()) as typeof page;
      expect(body.items).toHaveLength(1);
      expect((body.items[0] as Record<string, unknown>).id).toBe(membershipId);
      expect(body.hasMore).toBe(true);
      expect(body.nextCursor).toBe("cursor_next");
    });

    it("forwards systemId, entityId, auth, cursor, and limit to service", async () => {
      const emptyPage = { items: [], nextCursor: null, hasMore: false, totalCount: null };
      listMock().mockResolvedValueOnce(emptyPage);

      await createApp().request(`${baseUrl}?cursor=cur_abc&limit=5`);

      expect(listMock()).toHaveBeenCalledWith(
        expect.anything(),
        SYS_ID,
        entityId,
        MOCK_AUTH,
        "cur_abc",
        5,
      );
    });

    it("returns 200 with empty list when no memberships exist", async () => {
      const emptyPage = { items: [], nextCursor: null, hasMore: false, totalCount: null };
      listMock().mockResolvedValueOnce(emptyPage);

      const res = await createApp().request(baseUrl);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: unknown[]; hasMore: boolean };
      expect(body.items).toHaveLength(0);
      expect(body.hasMore).toBe(false);
    });

    it(`returns 400 for invalid ${label}Id param format`, async () => {
      const res = await createApp().request(`/systems/${SYS_ID}/${invalidParamSegment}`);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid systemId param format", async () => {
      const badUrl = `/systems/${INVALID_SYS_ID}/${urlSegment}/${entityId}/memberships`;
      const res = await createApp().request(badUrl);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("applies the readDefault rate limit category", () => {
      expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
    });

    it("returns 500 for unexpected errors", async () => {
      listMock().mockRejectedValueOnce(new Error("Query failed"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const res = await createApp().request(baseUrl);

      expect(res.status).toBe(500);
    });
  });
}
