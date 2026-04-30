import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { MOCK_SYSTEM_ID, makeCallerFactory } from "../test-helpers.js";

import {
  ENTITY_ID,
  ENTITY_TYPE_ID,
  MOCK_ENTITY_RESULT,
  VALID_ENCRYPTED_DATA,
} from "./structure-fixtures.js";

import type { SystemStructureEntityId } from "@pluralscape/types";

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

const { createStructureEntity } = await import("../../../services/structure/entity-crud/create.js");
const { getStructureEntity, listStructureEntities } =
  await import("../../../services/structure/entity-crud/queries.js");
const { updateStructureEntity } = await import("../../../services/structure/entity-crud/update.js");
const { archiveStructureEntity, restoreStructureEntity } =
  await import("../../../services/structure/entity-crud/lifecycle.js");

const { structureRouter } = await import("../../../trpc/routers/structure.js");

const createCaller = makeCallerFactory({ structure: structureRouter });

describe("structure router — entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("structure.entity.create", () => {
    it("calls createStructureEntity with correct systemId and returns result", async () => {
      vi.mocked(createStructureEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entity.create({
        systemId: MOCK_SYSTEM_ID,
        structureEntityTypeId: ENTITY_TYPE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sortOrder: 0,
        parentEntityId: null,
      });

      expect(vi.mocked(createStructureEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(createStructureEntity).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.structure.entity.create({
          systemId: MOCK_SYSTEM_ID,
          structureEntityTypeId: ENTITY_TYPE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
          parentEntityId: null,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  describe("structure.entity.get", () => {
    it("calls getStructureEntity with correct systemId and entityId", async () => {
      vi.mocked(getStructureEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entity.get({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(getStructureEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(getStructureEntity).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getStructureEntity).mock.calls[0]?.[2]).toBe(ENTITY_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("rejects invalid entityId format", async () => {
      const caller = createCaller();
      await expect(
        caller.structure.entity.get({
          systemId: MOCK_SYSTEM_ID,
          entityId: brandId<SystemStructureEntityId>("not-an-entity-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getStructureEntity).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entity.get({ systemId: MOCK_SYSTEM_ID, entityId: ENTITY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entity.list", () => {
    it("calls listStructureEntities and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_ENTITY_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listStructureEntities).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.structure.entity.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listStructureEntities)).toHaveBeenCalledOnce();
      expect(vi.mocked(listStructureEntities).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes entityTypeId filter to service", async () => {
      const mockResult = { data: [], nextCursor: null, hasMore: false, totalCount: null };
      vi.mocked(listStructureEntities).mockResolvedValue(mockResult);
      const caller = createCaller();
      await caller.structure.entity.list({
        systemId: MOCK_SYSTEM_ID,
        entityTypeId: ENTITY_TYPE_ID,
      });

      expect(vi.mocked(listStructureEntities).mock.calls[0]?.[3]).toMatchObject({
        entityTypeId: ENTITY_TYPE_ID,
      });
    });
  });

  describe("structure.entity.update", () => {
    it("calls updateStructureEntity with correct args and returns result", async () => {
      vi.mocked(updateStructureEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entity.update({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sortOrder: 0,
        version: 1,
        parentEntityId: null,
      });

      expect(vi.mocked(updateStructureEntity)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateStructureEntity).mock.calls[0]?.[2]).toBe(ENTITY_ID);
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateStructureEntity).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entity.update({
          systemId: MOCK_SYSTEM_ID,
          entityId: ENTITY_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
          version: 1,
          parentEntityId: null,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  describe("structure.entity.archive", () => {
    it("calls archiveStructureEntity and returns success", async () => {
      vi.mocked(archiveStructureEntity).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.structure.entity.archive({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(archiveStructureEntity)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveStructureEntity).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entity.archive({ systemId: MOCK_SYSTEM_ID, entityId: ENTITY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entity.restore", () => {
    it("calls restoreStructureEntity and returns result", async () => {
      vi.mocked(restoreStructureEntity).mockResolvedValue(MOCK_ENTITY_RESULT);
      const caller = createCaller();
      const result = await caller.structure.entity.restore({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
      });

      expect(vi.mocked(restoreStructureEntity)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_ENTITY_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreStructureEntity).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.entity.restore({ systemId: MOCK_SYSTEM_ID, entityId: ENTITY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
