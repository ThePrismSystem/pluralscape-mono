import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { MOCK_SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import {
  ENTITY_TYPE_ID,
  MOCK_ENTITY_TYPE_RESULT,
  VALID_ENCRYPTED_DATA,
} from "./structure-fixtures.js";

import type { SystemStructureEntityTypeId } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/structure/entity-type/create.js", () => ({
  createEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/get.js", () => ({
  getEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/list.js", () => ({
  listEntityTypes: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/update.js", () => ({
  updateEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/archive.js", () => ({
  archiveEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/restore.js", () => ({
  restoreEntityType: vi.fn(),
}));
vi.mock("../../../services/structure/entity-type/delete.js", () => ({
  deleteEntityType: vi.fn(),
}));

// The structure router module imports from all structure service domains.
// We need to mock all of them here even though this file only exercises
// entity-type procedures, otherwise the router's downstream imports would
// hit real implementations.
vi.mock("../../../services/structure/entity-crud/create.js", () => ({
  createStructureEntity: vi.fn(),
}));
vi.mock("../../../services/structure/entity-crud/queries.js", () => ({
  getStructureEntity: vi.fn(),
  listStructureEntities: vi.fn(),
}));
vi.mock("../../../services/structure/entity-crud/update.js", () => ({
  updateStructureEntity: vi.fn(),
}));
vi.mock("../../../services/structure/entity-crud/lifecycle.js", () => ({
  archiveStructureEntity: vi.fn(),
  restoreStructureEntity: vi.fn(),
  deleteStructureEntity: vi.fn(),
}));
vi.mock("../../../services/structure/link.js", () => ({
  createEntityLink: vi.fn(),
  listEntityLinks: vi.fn(),
  updateEntityLink: vi.fn(),
  deleteEntityLink: vi.fn(),
}));
vi.mock("../../../services/structure/member-link.js", () => ({
  createEntityMemberLink: vi.fn(),
  listEntityMemberLinks: vi.fn(),
  deleteEntityMemberLink: vi.fn(),
}));
vi.mock("../../../services/structure/association.js", () => ({
  createEntityAssociation: vi.fn(),
  listEntityAssociations: vi.fn(),
  deleteEntityAssociation: vi.fn(),
  getEntityHierarchy: vi.fn(),
}));

const { createEntityType } = await import("../../../services/structure/entity-type/create.js");
const { getEntityType } = await import("../../../services/structure/entity-type/get.js");
const { listEntityTypes } = await import("../../../services/structure/entity-type/list.js");
const { updateEntityType } = await import("../../../services/structure/entity-type/update.js");
const { archiveEntityType } = await import("../../../services/structure/entity-type/archive.js");
const { restoreEntityType } = await import("../../../services/structure/entity-type/restore.js");

const { structureRouter } = await import("../../../trpc/routers/structure.js");

const createCaller = makeCallerFactory({ structure: structureRouter });

describe("structure router — entity types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("structure.entityType.create", () => {
    it("calls createEntityType with correct systemId and returns result", async () => {
      vi.mocked(createEntityType).mockResolvedValue(MOCK_ENTITY_TYPE_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entityType.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sortOrder: 0,
      });

      expect(vi.mocked(createEntityType)).toHaveBeenCalledOnce();
      expect(vi.mocked(createEntityType).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_ENTITY_TYPE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.structure.entityType.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.structure.entityType.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entityType.get", () => {
    it("calls getEntityType with correct systemId and entityTypeId", async () => {
      vi.mocked(getEntityType).mockResolvedValue(MOCK_ENTITY_TYPE_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entityType.get({
        systemId: MOCK_SYSTEM_ID,
        entityTypeId: ENTITY_TYPE_ID,
      });

      expect(vi.mocked(getEntityType)).toHaveBeenCalledOnce();
      expect(vi.mocked(getEntityType).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getEntityType).mock.calls[0]?.[2]).toBe(ENTITY_TYPE_ID);
      expect(result).toEqual(MOCK_ENTITY_TYPE_RESULT);
    });

    it("rejects invalid entityTypeId format", async () => {
      const caller = createCaller();
      await expect(
        caller.structure.entityType.get({
          systemId: MOCK_SYSTEM_ID,
          entityTypeId: brandId<SystemStructureEntityTypeId>("not-a-type-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getEntityType).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity type not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entityType.get({ systemId: MOCK_SYSTEM_ID, entityTypeId: ENTITY_TYPE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entityType.list", () => {
    it("calls listEntityTypes and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_ENTITY_TYPE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listEntityTypes).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.structure.entityType.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listEntityTypes)).toHaveBeenCalledOnce();
      expect(vi.mocked(listEntityTypes).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });
  });

  describe("structure.entityType.update", () => {
    it("calls updateEntityType with correct args and returns result", async () => {
      vi.mocked(updateEntityType).mockResolvedValue(MOCK_ENTITY_TYPE_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entityType.update({
        systemId: MOCK_SYSTEM_ID,
        entityTypeId: ENTITY_TYPE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sortOrder: 0,
        version: 1,
      });

      expect(vi.mocked(updateEntityType)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateEntityType).mock.calls[0]?.[2]).toBe(ENTITY_TYPE_ID);
      expect(result).toEqual(MOCK_ENTITY_TYPE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateEntityType).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entityType.update({
          systemId: MOCK_SYSTEM_ID,
          entityTypeId: ENTITY_TYPE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  describe("structure.entityType.archive", () => {
    it("calls archiveEntityType and returns success", async () => {
      vi.mocked(archiveEntityType).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.structure.entityType.archive({
        systemId: MOCK_SYSTEM_ID,
        entityTypeId: ENTITY_TYPE_ID,
      });

      expect(vi.mocked(archiveEntityType)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveEntityType).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity type not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entityType.archive({
          systemId: MOCK_SYSTEM_ID,
          entityTypeId: ENTITY_TYPE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entityType.restore", () => {
    it("calls restoreEntityType and returns result", async () => {
      vi.mocked(restoreEntityType).mockResolvedValue(MOCK_ENTITY_TYPE_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entityType.restore({
        systemId: MOCK_SYSTEM_ID,
        entityTypeId: ENTITY_TYPE_ID,
      });

      expect(vi.mocked(restoreEntityType)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_ENTITY_TYPE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreEntityType).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity type not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entityType.restore({
          systemId: MOCK_SYSTEM_ID,
          entityTypeId: ENTITY_TYPE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
