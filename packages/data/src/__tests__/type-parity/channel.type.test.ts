/**
 * G4 parity (Body Zod ↔ Transform output) for Channel.
 *
 * Anchored to `ReturnType<typeof encryptChannelInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateChannelBodySchema, UpdateChannelBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptChannelInput, encryptChannelUpdate } from "../../transforms/channel.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Channel G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateChannelBodySchema's encryptedData slice equals encryptChannelInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateChannelBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptChannelInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateChannelBodySchema's encryptedData+version slice equals encryptChannelUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateChannelBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptChannelUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
