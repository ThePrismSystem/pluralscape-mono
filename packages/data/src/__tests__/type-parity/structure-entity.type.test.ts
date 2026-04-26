/**
 * G4 parity (Body Zod ↔ Transform output) for StructureEntity.
 *
 * Anchored to `ReturnType<typeof encryptStructureEntityInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateStructureEntityBodySchema,
  UpdateStructureEntityBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptStructureEntityInput,
  encryptStructureEntityUpdate,
} from "../../transforms/structure-entity.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("StructureEntity G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateStructureEntityBodySchema's encryptedData slice equals encryptStructureEntityInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateStructureEntityBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptStructureEntityInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateStructureEntityBodySchema's encryptedData+version slice equals encryptStructureEntityUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateStructureEntityBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptStructureEntityUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
