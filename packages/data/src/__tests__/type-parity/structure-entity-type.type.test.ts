/**
 * G4 parity (Body Zod ↔ Transform output) for StructureEntityType.
 *
 * Anchored to `ReturnType<typeof encryptStructureEntityTypeInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateStructureEntityTypeBodySchema,
  UpdateStructureEntityTypeBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptStructureEntityTypeInput,
  encryptStructureEntityTypeUpdate,
} from "../../transforms/structure-entity-type.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("StructureEntityType G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateStructureEntityTypeBodySchema's encryptedData slice equals encryptStructureEntityTypeInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateStructureEntityTypeBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptStructureEntityTypeInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateStructureEntityTypeBodySchema's encryptedData+version slice equals encryptStructureEntityTypeUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateStructureEntityTypeBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptStructureEntityTypeUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
