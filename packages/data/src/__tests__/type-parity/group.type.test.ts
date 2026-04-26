/**
 * G4 parity (Body Zod ↔ Transform output) for Group.
 *
 * Anchored to `ReturnType<typeof encryptGroupInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateGroupBodySchema, UpdateGroupBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptGroupInput, encryptGroupUpdate } from "../../transforms/group.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Group G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateGroupBodySchema's encryptedData slice equals encryptGroupInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateGroupBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptGroupInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateGroupBodySchema's encryptedData+version slice equals encryptGroupUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateGroupBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptGroupUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
