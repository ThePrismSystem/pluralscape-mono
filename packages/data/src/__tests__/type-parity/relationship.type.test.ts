/**
 * G4 parity (Body Zod ↔ Transform output) for Relationship.
 *
 * Anchored to `ReturnType<typeof encryptRelationshipInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateRelationshipBodySchema,
  UpdateRelationshipBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptRelationshipInput,
  encryptRelationshipUpdate,
} from "../../transforms/relationship.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Relationship G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateRelationshipBodySchema's encryptedData slice equals encryptRelationshipInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateRelationshipBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptRelationshipInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateRelationshipBodySchema's encryptedData+version slice equals encryptRelationshipUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateRelationshipBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptRelationshipUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
