/**
 * G4 parity (Body Zod ↔ Transform output) for Poll.
 *
 * Anchored to `ReturnType<typeof encryptPollInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreatePollBodySchema, UpdatePollBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptPollInput, encryptPollUpdate } from "../../transforms/poll.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Poll G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreatePollBodySchema's encryptedData slice equals encryptPollInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreatePollBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptPollInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdatePollBodySchema's encryptedData+version slice equals encryptPollUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdatePollBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptPollUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
