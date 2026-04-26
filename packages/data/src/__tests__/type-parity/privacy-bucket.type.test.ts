/**
 * G4 parity (Body Zod ↔ Transform output) for PrivacyBucket.
 *
 * Anchored to `ReturnType<typeof encryptBucketInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateBucketBodySchema, UpdateBucketBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptBucketInput, encryptBucketUpdate } from "../../transforms/privacy-bucket.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("PrivacyBucket G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateBucketBodySchema's encryptedData slice equals encryptBucketInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateBucketBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptBucketInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateBucketBodySchema's encryptedData+version slice equals encryptBucketUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateBucketBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptBucketUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
