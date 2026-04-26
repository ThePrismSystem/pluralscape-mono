import { describe, expect, it } from "vitest";

import { CreateMemberPhotoBodySchema, ReorderPhotosBodySchema } from "../member-photo.js";
import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
} from "../member.js";
import { MAX_ENCRYPTED_PHOTO_DATA_SIZE } from "../validation.constants.js";

// Body-schema shape parity (G4) lives in `packages/data/src/__tests__/type-parity/`
// — see bean `types-1spw`. This file owns the runtime parse-validation tests.

describe("CreateMemberBodySchema", () => {
  it("parses valid input", () => {
    const result = CreateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateMemberBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateMemberBodySchema.safeParse({ encryptedData: "" });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = CreateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==", admin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

describe("UpdateMemberBodySchema", () => {
  it("parses valid input", () => {
    const result = UpdateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==", version: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing version", () => {
    const result = UpdateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(false);
  });

  it("rejects version < 1", () => {
    const result = UpdateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==", version: 0 });
    expect(result.success).toBe(false);
  });
});

describe("DuplicateMemberBodySchema", () => {
  it("parses valid input with defaults", () => {
    const result = DuplicateMemberBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.copyPhotos).toBe(false);
      expect(result.data.copyFields).toBe(false);
      expect(result.data.copyMemberships).toBe(false);
    }
  });

  it("accepts explicit boolean flags", () => {
    const result = DuplicateMemberBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      copyPhotos: true,
      copyFields: true,
      copyMemberships: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.copyPhotos).toBe(true);
      expect(result.data.copyFields).toBe(true);
      expect(result.data.copyMemberships).toBe(true);
    }
  });
});

describe("CreateMemberPhotoBodySchema", () => {
  it("parses valid input without sortOrder", () => {
    const result = CreateMemberPhotoBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBeUndefined();
    }
  });

  it("accepts optional sortOrder", () => {
    const result = CreateMemberPhotoBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it("rejects negative sortOrder", () => {
    const result = CreateMemberPhotoBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData over MAX_ENCRYPTED_PHOTO_DATA_SIZE", () => {
    const oversized = "a".repeat(MAX_ENCRYPTED_PHOTO_DATA_SIZE + 1);
    const result = CreateMemberPhotoBodySchema.safeParse({ encryptedData: oversized });
    expect(result.success).toBe(false);
  });
});

describe("ReorderPhotosBodySchema", () => {
  it("parses valid reorder input", () => {
    const result = ReorderPhotosBodySchema.safeParse({
      order: [
        { id: "mp_abc", sortOrder: 0 },
        { id: "mp_def", sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty order array", () => {
    const result = ReorderPhotosBodySchema.safeParse({ order: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing order", () => {
    const result = ReorderPhotosBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
