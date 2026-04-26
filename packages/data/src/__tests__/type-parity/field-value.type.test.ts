/**
 * G4 parity (Body Zod ↔ Transform output) for FieldValue.
 *
 * Anchored to `ReturnType<typeof encryptFieldValueInput>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { SetFieldValueBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptFieldValueInput } from "../../transforms/custom-field.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FieldValue G4 parity (transform output ↔ Zod body schema)", () => {
  it("SetFieldValueBodySchema's encryptedData slice equals encryptFieldValueInput output", () => {
    type SetBodyEncryptedSlice = Pick<z.infer<typeof SetFieldValueBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptFieldValueInput>;
    expectTypeOf<Equal<SetBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
