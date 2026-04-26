/**
 * G4 parity (Body Zod ↔ Transform output) for InnerWorldEntity.
 *
 * Anchored to `ReturnType<typeof encryptInnerWorldEntityInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateEntityBodySchema, UpdateEntityBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptInnerWorldEntityInput,
  encryptInnerWorldEntityUpdate,
} from "../../transforms/innerworld-entity.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("InnerWorldEntity G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateEntityBodySchema's encryptedData slice equals encryptInnerWorldEntityInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateEntityBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptInnerWorldEntityInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateEntityBodySchema's encryptedData+version slice equals encryptInnerWorldEntityUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateEntityBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptInnerWorldEntityUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
