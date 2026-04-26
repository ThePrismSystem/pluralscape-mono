/**
 * G4 parity (Body Zod ↔ Transform output) for InnerWorldCanvas.
 *
 * Anchored to `ReturnType<typeof encryptCanvasUpdate>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { UpdateCanvasBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptCanvasUpdate } from "../../transforms/innerworld-canvas.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("InnerWorldCanvas G4 parity (transform output ↔ Zod body schema)", () => {
  it("UpdateCanvasBodySchema's encryptedData+version slice equals encryptCanvasUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateCanvasBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptCanvasUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
