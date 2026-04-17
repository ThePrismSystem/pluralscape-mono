import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { MOCK_SYSTEM_ID, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type {
  BucketId,
  FieldDefinitionId,
  FieldValueId,
  MemberId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/field-definition.service.js", () => ({
  createFieldDefinition: vi.fn(),
  getFieldDefinition: vi.fn(),
  listFieldDefinitions: vi.fn(),
  updateFieldDefinition: vi.fn(),
  archiveFieldDefinition: vi.fn(),
  restoreFieldDefinition: vi.fn(),
  deleteFieldDefinition: vi.fn(),
  clearFieldDefCache: vi.fn(),
}));

vi.mock("../../../services/field-value.service.js", () => ({
  setFieldValueForOwner: vi.fn(),
  listFieldValuesForOwner: vi.fn(),
  deleteFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../services/field-bucket-visibility.service.js", () => ({
  setFieldBucketVisibility: vi.fn(),
  removeFieldBucketVisibility: vi.fn(),
  listFieldBucketVisibility: vi.fn(),
}));

const {
  createFieldDefinition,
  getFieldDefinition,
  listFieldDefinitions,
  updateFieldDefinition,
  archiveFieldDefinition,
  restoreFieldDefinition,
  deleteFieldDefinition,
} = await import("../../../services/field-definition.service.js");

const { setFieldValueForOwner, listFieldValuesForOwner, deleteFieldValueForOwner } =
  await import("../../../services/field-value.service.js");

const { setFieldBucketVisibility, removeFieldBucketVisibility, listFieldBucketVisibility } =
  await import("../../../services/field-bucket-visibility.service.js");

const { fieldRouter } = await import("../../../trpc/routers/field.js");

const createCaller = makeCallerFactory({ field: fieldRouter });

const FIELD_DEF_ID = brandId<FieldDefinitionId>("fld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const BUCKET_ID = brandId<BucketId>("bkt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const MEMBER_ID = brandId<MemberId>("mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JmaWVsZA==";

const MOCK_FIELD_DEF_RESULT = {
  id: FIELD_DEF_ID,
  systemId: MOCK_SYSTEM_ID,
  fieldType: "text" as const,
  required: false,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const FIELD_VALUE_ID = brandId<FieldValueId>("fv_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const MOCK_FIELD_VALUE_RESULT = {
  id: FIELD_VALUE_ID,
  fieldDefinitionId: FIELD_DEF_ID,
  memberId: MEMBER_ID,
  structureEntityId: null,
  groupId: null,
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("field router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── field.definition ─────────────────────────────────────────────

  describe("field.definition.create", () => {
    it("calls createFieldDefinition with correct systemId and returns result", async () => {
      vi.mocked(createFieldDefinition).mockResolvedValue(MOCK_FIELD_DEF_RESULT);
      const caller = createCaller();
      const result = await caller.field.definition.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        fieldType: "text",
        required: false,
        sortOrder: 0,
      });

      expect(vi.mocked(createFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_FIELD_DEF_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.field.definition.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          fieldType: "text",
          required: false,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  describe("field.definition.get", () => {
    it("calls getFieldDefinition with correct systemId and fieldDefinitionId", async () => {
      vi.mocked(getFieldDefinition).mockResolvedValue(MOCK_FIELD_DEF_RESULT);
      const caller = createCaller();
      const result = await caller.field.definition.get({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
      });

      expect(vi.mocked(getFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getFieldDefinition).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(result).toEqual(MOCK_FIELD_DEF_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getFieldDefinition).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Field definition not found"),
      );
      const caller = createCaller();
      await expect(
        caller.field.definition.get({ systemId: MOCK_SYSTEM_ID, fieldDefinitionId: FIELD_DEF_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("field.definition.list", () => {
    it("calls listFieldDefinitions and returns result", async () => {
      const mockResult = {
        data: [MOCK_FIELD_DEF_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listFieldDefinitions).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.field.definition.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listFieldDefinitions)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFieldDefinitions).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes includeArchived option", async () => {
      vi.mocked(listFieldDefinitions).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.field.definition.list({ systemId: MOCK_SYSTEM_ID, includeArchived: true });

      const opts = vi.mocked(listFieldDefinitions).mock.calls[0]?.[3];
      expect(opts?.includeArchived).toBe(true);
    });
  });

  describe("field.definition.update", () => {
    it("calls updateFieldDefinition with correct systemId and fieldDefinitionId", async () => {
      vi.mocked(updateFieldDefinition).mockResolvedValue(MOCK_FIELD_DEF_RESULT);
      const caller = createCaller();
      const result = await caller.field.definition.update({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateFieldDefinition).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(result).toEqual(MOCK_FIELD_DEF_RESULT);
    });
  });

  describe("field.definition.archive", () => {
    it("calls archiveFieldDefinition and returns success", async () => {
      vi.mocked(archiveFieldDefinition).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.field.definition.archive({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveFieldDefinition).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
    });
  });

  describe("field.definition.restore", () => {
    it("calls restoreFieldDefinition and returns result", async () => {
      vi.mocked(restoreFieldDefinition).mockResolvedValue(MOCK_FIELD_DEF_RESULT);
      const caller = createCaller();
      const result = await caller.field.definition.restore({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
      });

      expect(vi.mocked(restoreFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreFieldDefinition).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(result).toEqual(MOCK_FIELD_DEF_RESULT);
    });
  });

  describe("field.definition.delete", () => {
    it("calls deleteFieldDefinition and returns success", async () => {
      vi.mocked(deleteFieldDefinition).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.field.definition.delete({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        force: false,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteFieldDefinition)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteFieldDefinition).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteFieldDefinition).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
    });

    it("passes force option to service", async () => {
      vi.mocked(deleteFieldDefinition).mockResolvedValue(undefined);
      const caller = createCaller();
      await caller.field.definition.delete({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        force: true,
      });

      expect(vi.mocked(deleteFieldDefinition).mock.calls[0]?.[5]).toEqual({ force: true });
    });

    it("surfaces ApiHttpError(409) as CONFLICT when has dependents", async () => {
      vi.mocked(deleteFieldDefinition).mockRejectedValue(
        new ApiHttpError(409, "HAS_DEPENDENTS", "Field definition has dependents"),
      );
      const caller = createCaller();
      await expect(
        caller.field.definition.delete({
          systemId: MOCK_SYSTEM_ID,
          fieldDefinitionId: FIELD_DEF_ID,
          force: false,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── field.value ───────────────────────────────────────────────────

  describe("field.value.set", () => {
    it("calls setFieldValueForOwner with correct args and returns result", async () => {
      vi.mocked(setFieldValueForOwner).mockResolvedValue(MOCK_FIELD_VALUE_RESULT);
      const caller = createCaller();
      const result = await caller.field.value.set({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        owner: { kind: "member", id: MEMBER_ID },
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(setFieldValueForOwner)).toHaveBeenCalledOnce();
      expect(vi.mocked(setFieldValueForOwner).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(setFieldValueForOwner).mock.calls[0]?.[2]).toEqual({
        kind: "member",
        id: MEMBER_ID,
      });
      expect(vi.mocked(setFieldValueForOwner).mock.calls[0]?.[3]).toBe(FIELD_DEF_ID);
      expect(result).toEqual(MOCK_FIELD_VALUE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when value already exists", async () => {
      vi.mocked(setFieldValueForOwner).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Field value already exists"),
      );
      const caller = createCaller();
      await expect(
        caller.field.value.set({
          systemId: MOCK_SYSTEM_ID,
          fieldDefinitionId: FIELD_DEF_ID,
          owner: { kind: "member", id: MEMBER_ID },
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  describe("field.value.list", () => {
    it("calls listFieldValuesForOwner with correct args", async () => {
      vi.mocked(listFieldValuesForOwner).mockResolvedValue([MOCK_FIELD_VALUE_RESULT]);
      const caller = createCaller();
      const result = await caller.field.value.list({
        systemId: MOCK_SYSTEM_ID,
        owner: { kind: "member", id: MEMBER_ID },
      });

      expect(vi.mocked(listFieldValuesForOwner)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFieldValuesForOwner).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listFieldValuesForOwner).mock.calls[0]?.[2]).toEqual({
        kind: "member",
        id: MEMBER_ID,
      });
      expect(result).toEqual([MOCK_FIELD_VALUE_RESULT]);
    });
  });

  describe("field.value.remove", () => {
    it("calls deleteFieldValueForOwner and returns success", async () => {
      vi.mocked(deleteFieldValueForOwner).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.field.value.remove({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        owner: { kind: "member", id: MEMBER_ID },
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteFieldValueForOwner)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteFieldValueForOwner).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteFieldValueForOwner).mock.calls[0]?.[2]).toEqual({
        kind: "member",
        id: MEMBER_ID,
      });
      expect(vi.mocked(deleteFieldValueForOwner).mock.calls[0]?.[3]).toBe(FIELD_DEF_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteFieldValueForOwner).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Field value not found"),
      );
      const caller = createCaller();
      await expect(
        caller.field.value.remove({
          systemId: MOCK_SYSTEM_ID,
          fieldDefinitionId: FIELD_DEF_ID,
          owner: { kind: "member", id: MEMBER_ID },
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── field.bucketVisibility ────────────────────────────────────────

  describe("field.bucketVisibility.set", () => {
    it("calls setFieldBucketVisibility with correct args and returns result", async () => {
      const mockResult = { fieldDefinitionId: FIELD_DEF_ID, bucketId: BUCKET_ID };
      vi.mocked(setFieldBucketVisibility).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.field.bucketVisibility.set({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        bucketId: BUCKET_ID,
      });

      expect(vi.mocked(setFieldBucketVisibility)).toHaveBeenCalledOnce();
      expect(vi.mocked(setFieldBucketVisibility).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(setFieldBucketVisibility).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(vi.mocked(setFieldBucketVisibility).mock.calls[0]?.[3]).toBe(BUCKET_ID);
      expect(result).toEqual(mockResult);
    });
  });

  describe("field.bucketVisibility.remove", () => {
    it("calls removeFieldBucketVisibility and returns success", async () => {
      vi.mocked(removeFieldBucketVisibility).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.field.bucketVisibility.remove({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
        bucketId: BUCKET_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(removeFieldBucketVisibility)).toHaveBeenCalledOnce();
      expect(vi.mocked(removeFieldBucketVisibility).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(removeFieldBucketVisibility).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(vi.mocked(removeFieldBucketVisibility).mock.calls[0]?.[3]).toBe(BUCKET_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(removeFieldBucketVisibility).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Field bucket visibility not found"),
      );
      const caller = createCaller();
      await expect(
        caller.field.bucketVisibility.remove({
          systemId: MOCK_SYSTEM_ID,
          fieldDefinitionId: FIELD_DEF_ID,
          bucketId: BUCKET_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("field.bucketVisibility.list", () => {
    it("calls listFieldBucketVisibility with correct args", async () => {
      const mockResult = [{ fieldDefinitionId: FIELD_DEF_ID, bucketId: BUCKET_ID }];
      vi.mocked(listFieldBucketVisibility).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.field.bucketVisibility.list({
        systemId: MOCK_SYSTEM_ID,
        fieldDefinitionId: FIELD_DEF_ID,
      });

      expect(vi.mocked(listFieldBucketVisibility)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFieldBucketVisibility).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listFieldBucketVisibility).mock.calls[0]?.[2]).toBe(FIELD_DEF_ID);
      expect(result).toEqual(mockResult);
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listFieldDefinitions).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.field.definition.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createFieldDefinition).mockResolvedValue(MOCK_FIELD_DEF_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.field.definition.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          fieldType: "text",
          required: false,
          sortOrder: 0,
        }),
      "write",
    );
  });
});
