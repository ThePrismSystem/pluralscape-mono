/**
 * G4 parity (Body Zod ↔ Transform output) for Note.
 *
 * Anchored to `ReturnType<typeof encryptNoteInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateNoteBodySchema, UpdateNoteBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptNoteInput, encryptNoteUpdate } from "../../transforms/note.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Note G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateNoteBodySchema's encryptedData slice equals encryptNoteInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateNoteBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptNoteInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateNoteBodySchema's encryptedData+version slice equals encryptNoteUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateNoteBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptNoteUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
