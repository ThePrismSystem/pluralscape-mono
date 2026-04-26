/**
 * G4 parity (Body Zod ↔ Transform output) for InnerWorldRegion.
 *
 * Anchored to `ReturnType<typeof encryptInnerWorldRegionInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateRegionBodySchema, UpdateRegionBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptInnerWorldRegionInput,
  encryptInnerWorldRegionUpdate,
} from "../../transforms/innerworld-region.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("InnerWorldRegion G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateRegionBodySchema's encryptedData slice equals encryptInnerWorldRegionInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateRegionBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptInnerWorldRegionInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateRegionBodySchema's encryptedData+version slice equals encryptInnerWorldRegionUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateRegionBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptInnerWorldRegionUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
