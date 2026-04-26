/**
 * G4 parity (Body Zod ↔ Transform output) for BoardMessage.
 *
 * Anchored to `ReturnType<typeof encryptBoardMessageInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateBoardMessageBodySchema,
  UpdateBoardMessageBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptBoardMessageInput,
  encryptBoardMessageUpdate,
} from "../../transforms/board-message.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("BoardMessage G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateBoardMessageBodySchema's encryptedData slice equals encryptBoardMessageInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateBoardMessageBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptBoardMessageInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateBoardMessageBodySchema's encryptedData+version slice equals encryptBoardMessageUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateBoardMessageBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptBoardMessageUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
