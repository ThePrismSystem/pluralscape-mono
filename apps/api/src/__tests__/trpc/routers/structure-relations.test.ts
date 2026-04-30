import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { MOCK_SYSTEM_ID, assertProcedureRateLimited, makeCallerFactory } from "../test-helpers.js";

import {
  ASSOCIATION_ID,
  ENTITY_ID,
  LINK_ID,
  MEMBER_ID,
  MEMBER_LINK_ID,
  MOCK_ASSOCIATION_RESULT,
  MOCK_ENTITY_TYPE_RESULT,
  MOCK_LINK_RESULT,
  MOCK_MEMBER_LINK_RESULT,
  VALID_ENCRYPTED_DATA,
} from "./structure-fixtures.js";

import type {
  SystemStructureEntityAssociationId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
} from "@pluralscape/types";

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

const { createEntityType } = await import("../../../services/structure/entity-type/create.js");
const { listEntityTypes } = await import("../../../services/structure/entity-type/list.js");

const { createEntityLink, listEntityLinks, updateEntityLink, deleteEntityLink } =
  await import("../../../services/structure/link.js");

const { createEntityMemberLink, listEntityMemberLinks, deleteEntityMemberLink } =
  await import("../../../services/structure/member-link.js");

const { createEntityAssociation, listEntityAssociations, deleteEntityAssociation } =
  await import("../../../services/structure/association.js");

const { structureRouter } = await import("../../../trpc/routers/structure.js");

const createCaller = makeCallerFactory({ structure: structureRouter });

describe("structure router — links, member links, associations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
          linkId: brandId<SystemStructureEntityLinkId>("not-a-link-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

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
          memberLinkId: brandId<SystemStructureEntityMemberLinkId>("not-a-member-link-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

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
          associationId: brandId<SystemStructureEntityAssociationId>("not-an-association-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  describe("rate limiting", () => {
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
});
