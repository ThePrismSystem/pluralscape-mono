/**
 * G4 parity (Body Zod ↔ Transform output) for Acknowledgement.
 *
 * Anchored to `ReturnType<typeof encryptAcknowledgementInput>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 *
 * NOTE: `ConfirmAcknowledgementBodySchema.encryptedData` is intentionally
 * optional (clients may confirm without re-encrypting), while
 * `encryptAcknowledgementConfirm` always returns a populated `encryptedData`.
 * That asymmetry is by design (route accepts skip-encrypt confirm), so no
 * Confirm parity assertion is included here.
 */

import { CreateAcknowledgementBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptAcknowledgementInput } from "../../transforms/acknowledgement.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Acknowledgement G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateAcknowledgementBodySchema's encryptedData slice equals encryptAcknowledgementInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateAcknowledgementBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptAcknowledgementInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
