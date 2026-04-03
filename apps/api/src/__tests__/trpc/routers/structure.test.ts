import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type {
  MemberId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/structure-entity-type.service.js", () => ({
  createEntityType: vi.fn(),
  getEntityType: vi.fn(),
  listEntityTypes: vi.fn(),
  updateEntityType: vi.fn(),
  archiveEntityType: vi.fn(),
  restoreEntityType: vi.fn(),
}));

vi.mock("../../../services/structure-entity-crud.service.js", () => ({
  createStructureEntity: vi.fn(),
  getStructureEntity: vi.fn(),
  listStructureEntities: vi.fn(),
  updateStructureEntity: vi.fn(),
  archiveStructureEntity: vi.fn(),
  restoreStructureEntity: vi.fn(),
}));

vi.mock("../../../services/structure-entity-link.service.js", () => ({
  createEntityLink: vi.fn(),
  listEntityLinks: vi.fn(),
  updateEntityLink: vi.fn(),
  deleteEntityLink: vi.fn(),
}));

vi.mock("../../../services/structure-entity-member-link.service.js", () => ({
  createEntityMemberLink: vi.fn(),
  listEntityMemberLinks: vi.fn(),
  deleteEntityMemberLink: vi.fn(),
}));

vi.mock("../../../services/structure-entity-association.service.js", () => ({
  createEntityAssociation: vi.fn(),
  listEntityAssociations: vi.fn(),
  deleteEntityAssociation: vi.fn(),
}));

const {
  createEntityType,
  getEntityType,
  listEntityTypes,
  updateEntityType,
  archiveEntityType,
  restoreEntityType,
} = await import("../../../services/structure-entity-type.service.js");

const {
  createStructureEntity,
  getStructureEntity,
  listStructureEntities,
  updateStructureEntity,
  archiveStructureEntity,
  restoreStructureEntity,
} = await import("../../../services/structure-entity-crud.service.js");

const { createEntityLink, listEntityLinks, updateEntityLink, deleteEntityLink } =
  await import("../../../services/structure-entity-link.service.js");

const { createEntityMemberLink, listEntityMemberLinks, deleteEntityMemberLink } =
  await import("../../../services/structure-entity-member-link.service.js");

const { createEntityAssociation, listEntityAssociations, deleteEntityAssociation } =
  await import("../../../services/structure-entity-association.service.js");

const { structureRouter } = await import("../../../trpc/routers/structure.js");

const createCaller = makeCallerFactory({ structure: structureRouter });

// ── IDs ──────────────────────────────────────────────────────────────

const ENTITY_TYPE_ID = "stet_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemStructureEntityTypeId;
const ENTITY_ID = "ste_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemStructureEntityId;
const LINK_ID = "stel_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemStructureEntityLinkId;
const MEMBER_LINK_ID =
  "steml_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemStructureEntityMemberLinkId;
const ASSOCIATION_ID =
  "stea_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemStructureEntityAssociationId;
const MEMBER_ID = "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as MemberId;

const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";
const NOW = 1_700_000_000_000 as UnixMillis;

// ── Mock results ─────────────────────────────────────────────────────

const MOCK_ENTITY_TYPE_RESULT = {
  id: ENTITY_TYPE_ID,
  systemId: MOCK_SYSTEM_ID,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_ENTITY_RESULT = {
  id: ENTITY_ID,
  systemId: MOCK_SYSTEM_ID,
  entityTypeId: ENTITY_TYPE_ID,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_LINK_RESULT = {
  id: LINK_ID,
  systemId: MOCK_SYSTEM_ID,
  entityId: ENTITY_ID,
  parentEntityId: null,
  sortOrder: 0,
  createdAt: NOW,
};

const MOCK_MEMBER_LINK_RESULT = {
  id: MEMBER_LINK_ID,
  systemId: MOCK_SYSTEM_ID,
  parentEntityId: ENTITY_ID,
  memberId: MEMBER_ID,
  sortOrder: 0,
  createdAt: NOW,
};

const MOCK_ASSOCIATION_RESULT = {
  id: ASSOCIATION_ID,
  systemId: MOCK_SYSTEM_ID,
  sourceEntityId: ENTITY_ID,
  targetEntityId: ENTITY_ID,
  createdAt: NOW,
};

describe("structure router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Entity Types: create ────────────────────────────────────────

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
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
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

  // ── Entity Types: get ───────────────────────────────────────────

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
          entityTypeId: "not-a-type-id" as SystemStructureEntityTypeId,
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

  // ── Entity Types: list ──────────────────────────────────────────

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

  // ── Entity Types: update ────────────────────────────────────────

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

  // ── Entity Types: archive ───────────────────────────────────────

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

  // ── Entity Types: restore ───────────────────────────────────────

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

  // ── Entities: create ────────────────────────────────────────────

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

  // ── Entities: get ───────────────────────────────────────────────

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
          entityId: "not-an-entity-id" as SystemStructureEntityId,
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

  // ── Entities: list ──────────────────────────────────────────────

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

  // ── Entities: update ────────────────────────────────────────────

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

  // ── Entities: archive ───────────────────────────────────────────

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

  // ── Entities: restore ───────────────────────────────────────────

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

  // ── Links: create ───────────────────────────────────────────────

  describe("structure.link.create", () => {
    it("calls createEntityLink with correct systemId and returns result", async () => {
      vi.mocked(createEntityLink).mockResolvedValue(MOCK_LINK_RESULT);
      const caller = createCaller();
      const result = await caller.structure.link.create({
        systemId: MOCK_SYSTEM_ID,
        entityId: ENTITY_ID,
        parentEntityId: null,
        sortOrder: 0,
      });

      expect(vi.mocked(createEntityLink)).toHaveBeenCalledOnce();
      expect(vi.mocked(createEntityLink).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_LINK_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.structure.link.create({
          systemId: MOCK_SYSTEM_ID,
          entityId: ENTITY_ID,
          parentEntityId: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── Links: list ─────────────────────────────────────────────────

  describe("structure.link.list", () => {
    it("calls listEntityLinks and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_LINK_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listEntityLinks).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.structure.link.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listEntityLinks)).toHaveBeenCalledOnce();
      expect(vi.mocked(listEntityLinks).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── Links: update ───────────────────────────────────────────────

  describe("structure.link.update", () => {
    it("calls updateEntityLink with correct args and returns result", async () => {
      vi.mocked(updateEntityLink).mockResolvedValue(MOCK_LINK_RESULT);
      const caller = createCaller();
      const result = await caller.structure.link.update({
        systemId: MOCK_SYSTEM_ID,
        linkId: LINK_ID,
        sortOrder: 1,
      });

      expect(vi.mocked(updateEntityLink)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateEntityLink).mock.calls[0]?.[2]).toBe(LINK_ID);
      expect(result).toEqual(MOCK_LINK_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(updateEntityLink).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Link not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.link.update({ systemId: MOCK_SYSTEM_ID, linkId: LINK_ID, sortOrder: 1 }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── Links: delete ───────────────────────────────────────────────

  describe("structure.link.delete", () => {
    it("calls deleteEntityLink and returns success", async () => {
      vi.mocked(deleteEntityLink).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.structure.link.delete({
        systemId: MOCK_SYSTEM_ID,
        linkId: LINK_ID,
      });

      expect(vi.mocked(deleteEntityLink)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });

    it("rejects invalid linkId format", async () => {
      const caller = createCaller();
      await expect(
        caller.structure.link.delete({
          systemId: MOCK_SYSTEM_ID,
          linkId: "not-a-link-id" as SystemStructureEntityLinkId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── Member Links: create ────────────────────────────────────────

  describe("structure.memberLink.create", () => {
    it("calls createEntityMemberLink with correct systemId and returns result", async () => {
      vi.mocked(createEntityMemberLink).mockResolvedValue(MOCK_MEMBER_LINK_RESULT);
      const caller = createCaller();
      const result = await caller.structure.memberLink.create({
        systemId: MOCK_SYSTEM_ID,
        parentEntityId: ENTITY_ID,
        memberId: MEMBER_ID,
        sortOrder: 0,
      });

      expect(vi.mocked(createEntityMemberLink)).toHaveBeenCalledOnce();
      expect(vi.mocked(createEntityMemberLink).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_MEMBER_LINK_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(createEntityMemberLink).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
      );
      const caller = createCaller();
      await expect(
        caller.structure.memberLink.create({
          systemId: MOCK_SYSTEM_ID,
          parentEntityId: ENTITY_ID,
          memberId: MEMBER_ID,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── Member Links: list ──────────────────────────────────────────

  describe("structure.memberLink.list", () => {
    it("calls listEntityMemberLinks and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_MEMBER_LINK_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listEntityMemberLinks).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.structure.memberLink.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listEntityMemberLinks)).toHaveBeenCalledOnce();
      expect(vi.mocked(listEntityMemberLinks).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── Member Links: delete ────────────────────────────────────────

  describe("structure.memberLink.delete", () => {
    it("calls deleteEntityMemberLink and returns success", async () => {
      vi.mocked(deleteEntityMemberLink).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.structure.memberLink.delete({
        systemId: MOCK_SYSTEM_ID,
        memberLinkId: MEMBER_LINK_ID,
      });

      expect(vi.mocked(deleteEntityMemberLink)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });

    it("rejects invalid memberLinkId format", async () => {
      const caller = createCaller();
      await expect(
        caller.structure.memberLink.delete({
          systemId: MOCK_SYSTEM_ID,
          memberLinkId: "not-a-member-link-id" as SystemStructureEntityMemberLinkId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── Associations: create ────────────────────────────────────────

  describe("structure.association.create", () => {
    it("calls createEntityAssociation with correct systemId and returns result", async () => {
      vi.mocked(createEntityAssociation).mockResolvedValue(MOCK_ASSOCIATION_RESULT);
      const caller = createCaller();
      const result = await caller.structure.association.create({
        systemId: MOCK_SYSTEM_ID,
        sourceEntityId: ENTITY_ID,
        targetEntityId: ENTITY_ID,
      });

      expect(vi.mocked(createEntityAssociation)).toHaveBeenCalledOnce();
      expect(vi.mocked(createEntityAssociation).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_ASSOCIATION_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.structure.association.create({
          systemId: MOCK_SYSTEM_ID,
          sourceEntityId: ENTITY_ID,
          targetEntityId: ENTITY_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── Associations: list ──────────────────────────────────────────

  describe("structure.association.list", () => {
    it("calls listEntityAssociations and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_ASSOCIATION_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listEntityAssociations).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.structure.association.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listEntityAssociations)).toHaveBeenCalledOnce();
      expect(vi.mocked(listEntityAssociations).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });
  });

  // ── Associations: delete ────────────────────────────────────────

  describe("structure.association.delete", () => {
    it("calls deleteEntityAssociation and returns success", async () => {
      vi.mocked(deleteEntityAssociation).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.structure.association.delete({
        systemId: MOCK_SYSTEM_ID,
        associationId: ASSOCIATION_ID,
      });

      expect(vi.mocked(deleteEntityAssociation)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });

    it("rejects invalid associationId format", async () => {
      const caller = createCaller();
      await expect(
        caller.structure.association.delete({
          systemId: MOCK_SYSTEM_ID,
          associationId: "not-an-association-id" as SystemStructureEntityAssociationId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listEntityTypes).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.structure.entityType.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createEntityType).mockResolvedValue(MOCK_ENTITY_TYPE_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.structure.entityType.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
        }),
      "write",
    );
  });
});
