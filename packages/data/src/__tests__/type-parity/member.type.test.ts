/**
 * G4 parity (Body Zod ↔ Transform output) for Member.
 *
 * Anchored to `ReturnType<typeof encryptMemberInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptMemberInput, encryptMemberUpdate } from "../../transforms/member.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Member G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateMemberBodySchema's encryptedData slice equals encryptMemberInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateMemberBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptMemberInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateMemberBodySchema's encryptedData+version slice equals encryptMemberUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateMemberBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptMemberUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("DuplicateMemberBodySchema = encryptMemberInput output + duplication knobs", () => {
    type DuplicateBody = z.infer<typeof DuplicateMemberBodySchema>;
    type Expected = ReturnType<typeof encryptMemberInput> & {
      copyPhotos: boolean;
      copyFields: boolean;
      copyMemberships: boolean;
    };
    expectTypeOf<Equal<DuplicateBody, Expected>>().toEqualTypeOf<true>();
  });
});
