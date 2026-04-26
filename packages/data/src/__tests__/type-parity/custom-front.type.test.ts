/**
 * G4 parity (Body Zod ↔ Transform output) for CustomFront.
 *
 * Anchored to `ReturnType<typeof encryptCustomFrontInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateCustomFrontBodySchema, UpdateCustomFrontBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptCustomFrontInput,
  encryptCustomFrontUpdate,
} from "../../transforms/custom-front.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("CustomFront G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateCustomFrontBodySchema's encryptedData slice equals encryptCustomFrontInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateCustomFrontBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptCustomFrontInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateCustomFrontBodySchema's encryptedData+version slice equals encryptCustomFrontUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateCustomFrontBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptCustomFrontUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
