/**
 * G4 parity (Body Zod ↔ Transform output) for FrontingComment.
 *
 * Anchored to `ReturnType<typeof encryptFrontingCommentInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateFrontingCommentBodySchema,
  UpdateFrontingCommentBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptFrontingCommentInput,
  encryptFrontingCommentUpdate,
} from "../../transforms/fronting-comment.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingComment G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateFrontingCommentBodySchema's encryptedData slice equals encryptFrontingCommentInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateFrontingCommentBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptFrontingCommentInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateFrontingCommentBodySchema's encryptedData+version slice equals encryptFrontingCommentUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateFrontingCommentBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptFrontingCommentUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
