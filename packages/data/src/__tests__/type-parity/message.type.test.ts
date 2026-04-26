/**
 * G4 parity (Body Zod ↔ Transform output) for Message.
 *
 * Anchored to `ReturnType<typeof encryptMessageInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateMessageBodySchema, UpdateMessageBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptMessageInput, encryptMessageUpdate } from "../../transforms/message.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Message G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateMessageBodySchema's encryptedData slice equals encryptMessageInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateMessageBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptMessageInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateMessageBodySchema's encryptedData+version slice equals encryptMessageUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateMessageBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptMessageUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
