import { describe, expect, expectTypeOf, it } from "vitest";

import { CreateMemberPhotoBodySchema, ReorderPhotosBodySchema } from "../member-photo.js";
import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
} from "../member.js";

import type { CreateMemberPhotoBody, Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("CreateMemberBodySchema", () => {
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<z.infer<typeof CreateMemberBodySchema>, { encryptedData: string }>
    >().toEqualTypeOf<true>();
  });

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
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<z.infer<typeof UpdateMemberBodySchema>, { encryptedData: string; version: number }>
    >().toEqualTypeOf<true>();
  });

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
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof DuplicateMemberBodySchema>,
        {
          encryptedData: string;
          copyPhotos: boolean;
          copyFields: boolean;
          copyMemberships: boolean;
        }
      >
    >().toEqualTypeOf<true>();
  });

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
  it("infers the documented body shape", () => {
    expectTypeOf<
      z.infer<typeof CreateMemberPhotoBodySchema>
    >().toEqualTypeOf<CreateMemberPhotoBody>();
  });

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
