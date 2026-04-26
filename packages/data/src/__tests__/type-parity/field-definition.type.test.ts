/**
 * G4 parity (Body Zod ↔ Transform output) for FieldDefinition.
 *
 * Anchored to `ReturnType<typeof encryptFieldDefinitionInput>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateFieldDefinitionBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptFieldDefinitionInput } from "../../transforms/custom-field.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FieldDefinition G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateFieldDefinitionBodySchema's encryptedData slice equals encryptFieldDefinitionInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateFieldDefinitionBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptFieldDefinitionInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
