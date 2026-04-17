import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { InnerWorldEntityId, InnerWorldRegionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/innerworld-entity.service.js", () => ({
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  listEntities: vi.fn(),
  updateEntity: vi.fn(),
  archiveEntity: vi.fn(),
  restoreEntity: vi.fn(),
}));

vi.mock("../../../services/innerworld-region.service.js", () => ({
  createRegion: vi.fn(),
  getRegion: vi.fn(),
  listRegions: vi.fn(),
  updateRegion: vi.fn(),
  archiveRegion: vi.fn(),
  restoreRegion: vi.fn(),
}));

vi.mock("../../../services/innerworld-canvas.service.js", () => ({
  getCanvas: vi.fn(),
  upsertCanvas: vi.fn(),
}));

const { createEntity, getEntity, listEntities, updateEntity, archiveEntity, restoreEntity } =
  await import("../../../services/innerworld-entity.service.js");

const { createRegion, getRegion, listRegions, updateRegion, archiveRegion, restoreRegion } =
  await import("../../../services/innerworld-region.service.js");

const { getCanvas, upsertCanvas } = await import("../../../services/innerworld-canvas.service.js");

const { innerworldRouter } = await import("../../../trpc/routers/innerworld.js");

const createCaller = makeCallerFactory({ innerworld: innerworldRouter });

const ENTITY_ID = brandId<InnerWorldEntityId>("iwe_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const REGION_ID = brandId<InnerWorldRegionId>("iwr_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_ENTITY_RESULT = {
  id: ENTITY_ID,
  systemId: MOCK_SYSTEM_ID,
  regionId: null,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

const MOCK_REGION_RESULT = {
  id: REGION_ID,
  systemId: MOCK_SYSTEM_ID,
  parentRegionId: null,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

const MOCK_CANVAS_RESULT = {
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("innerworld router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Entity: create ────────────────────────────────────────────────

  describe("innerworld.entity.create", () => {
    it("calls createEntity with correct systemId and returns result", async () => {
      vi.mocked(createEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.entity.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(createEntity).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.innerworld.entity.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.innerworld.entity.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── Entity: get ──────────────────────────────────────────────────

  describe("innerworld.entity.get", () => {
    it("calls getEntity with correct systemId and entityId", async () => {
      vi.mocked(getEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.entity.get({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(getEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(getEntity).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getEntity).mock.calls[0]?.[2]).toBe(ENTITY_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("rejects invalid entityId format", async () => {
      const caller = createCaller();
      await expect(
        caller.innerworld.entity.get({
          systemId: MOCK_SYSTEM_ID,
          entityId: brandId<InnerWorldEntityId>("not-an-entity-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getEntity).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
      );
      const caller = createCaller();
      await expect(
        caller.innerworld.entity.get({ systemId: MOCK_SYSTEM_ID, entityId: ENTITY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── Entity: list ─────────────────────────────────────────────────

  describe("innerworld.entity.list", () => {
    it("calls listEntities and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_ENTITY_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listEntities).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.innerworld.entity.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listEntities)).toHaveBeenCalledOnce();
      expect(vi.mocked(listEntities).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes regionId filter to service", async () => {
      const mockResult = { data: [], nextCursor: null, hasMore: false, totalCount: null };
      vi.mocked(listEntities).mockResolvedValue(mockResult);
      const caller = createCaller();
      await caller.innerworld.entity.list({ systemId: MOCK_SYSTEM_ID, regionId: REGION_ID });

      expect(vi.mocked(listEntities).mock.calls[0]?.[3]).toMatchObject({
        regionId: REGION_ID,
      });
    });
  });

  // ── Entity: update ───────────────────────────────────────────────

  describe("innerworld.entity.update", () => {
    it("calls updateEntity with correct args and returns result", async () => {
      vi.mocked(updateEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.entity.update({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateEntity).mock.calls[0]?.[2]).toBe(ENTITY_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateEntity).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.innerworld.entity.update({
          systemId: MOCK_SYSTEM_ID,
          entityId: ENTITY_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── Entity: archive ──────────────────────────────────────────────

  describe("innerworld.entity.archive", () => {
    it("calls archiveEntity and returns success", async () => {
      vi.mocked(archiveEntity).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.innerworld.entity.archive({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(archiveEntity)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });
  });

  // ── Entity: restore ──────────────────────────────────────────────

  describe("innerworld.entity.restore", () => {
    it("calls restoreEntity and returns result", async () => {
      vi.mocked(restoreEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.entity.restore({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(restoreEntity)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });
  });

  // ── Region: create ───────────────────────────────────────────────

  describe("innerworld.region.create", () => {
    it("calls createRegion with correct systemId and returns result", async () => {
      vi.mocked(createRegion).mockResolvedValue(MOCK_REGION_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.region.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createRegion)).toHaveBeenCalledOnce();
      expect(vi.mocked(createRegion).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_REGION_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.innerworld.region.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── Region: get ──────────────────────────────────────────────────

  describe("innerworld.region.get", () => {
    it("calls getRegion with correct systemId and regionId", async () => {
      vi.mocked(getRegion).mockResolvedValue(MOCK_REGION_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.region.get({
        systemId: MOCK_SYSTEM_ID,
        regionId: REGION_ID,
      });

      expect(vi.mocked(getRegion)).toHaveBeenCalledOnce();
      expect(vi.mocked(getRegion).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getRegion).mock.calls[0]?.[2]).toBe(REGION_ID);
      expect(result).toEqual(MOCK_REGION_RESULT);
    });

    it("rejects invalid regionId format", async () => {
      const caller = createCaller();
      await expect(
        caller.innerworld.region.get({
          systemId: MOCK_SYSTEM_ID,
          regionId: brandId<InnerWorldRegionId>("not-a-region-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── Region: list ─────────────────────────────────────────────────

  describe("innerworld.region.list", () => {
    it("calls listRegions and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_REGION_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listRegions).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.innerworld.region.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listRegions)).toHaveBeenCalledOnce();
      expect(vi.mocked(listRegions).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── Region: update ───────────────────────────────────────────────

  describe("innerworld.region.update", () => {
    it("calls updateRegion with correct args and returns result", async () => {
      vi.mocked(updateRegion).mockResolvedValue(MOCK_REGION_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.region.update({
        systemId: MOCK_SYSTEM_ID,
        regionId: REGION_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateRegion)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateRegion).mock.calls[0]?.[2]).toBe(REGION_ID);
      expect(result).toEqual(MOCK_REGION_RESULT);
    });
  });

  // ── Region: archive ──────────────────────────────────────────────

  describe("innerworld.region.archive", () => {
    it("calls archiveRegion and returns success", async () => {
      vi.mocked(archiveRegion).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.innerworld.region.archive({
        systemId: MOCK_SYSTEM_ID,
        regionId: REGION_ID,
      });

      expect(vi.mocked(archiveRegion)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });
  });

  // ── Region: restore ──────────────────────────────────────────────

  describe("innerworld.region.restore", () => {
    it("calls restoreRegion and returns result", async () => {
      vi.mocked(restoreRegion).mockResolvedValue(MOCK_REGION_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.region.restore({
        systemId: MOCK_SYSTEM_ID,
        regionId: REGION_ID,
      });

      expect(vi.mocked(restoreRegion)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_REGION_RESULT);
    });
  });

  // ── Canvas: get ──────────────────────────────────────────────────

  describe("innerworld.canvas.get", () => {
    it("calls getCanvas with correct systemId and returns result", async () => {
      vi.mocked(getCanvas).mockResolvedValue(MOCK_CANVAS_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.canvas.get({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(getCanvas)).toHaveBeenCalledOnce();
      expect(vi.mocked(getCanvas).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_CANVAS_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.innerworld.canvas.get({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getCanvas).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Canvas not found"),
      );
      const caller = createCaller();
      await expect(caller.innerworld.canvas.get({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── Canvas: upsert ───────────────────────────────────────────────

  describe("innerworld.canvas.upsert", () => {
    it("calls upsertCanvas with correct systemId and returns result", async () => {
      vi.mocked(upsertCanvas).mockResolvedValue(MOCK_CANVAS_RESULT);
      const caller = createCaller();
      const result = await caller.innerworld.canvas.upsert({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(upsertCanvas)).toHaveBeenCalledOnce();
      expect(vi.mocked(upsertCanvas).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_CANVAS_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(upsertCanvas).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = createCaller();
      await expect(
        caller.innerworld.canvas.upsert({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listEntities).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.innerworld.entity.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.innerworld.entity.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      "write",
    );
  });
});
