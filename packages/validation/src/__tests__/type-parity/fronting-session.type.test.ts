/**
 * Zod parity for FrontingSession. Locks the canonical chain:
 * - G3: Domain ↔ Zod encrypted input
 *
 * Asserts that `z.infer<typeof FrontingSessionEncryptedInputSchema>` matches
 * `Pick<FrontingSession, FrontingSessionEncryptedFields>` and the canonical
 * `FrontingSessionEncryptedInput` alias from `@pluralscape/types`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { FrontingSessionEncryptedInputSchema } from "../../fronting-session.js";

import type {
  Equal,
  FrontingSession,
  FrontingSessionEncryptedFields,
  FrontingSessionEncryptedInput,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingSession parity (G3: Domain ↔ Zod encrypted input)", () => {
  it("FrontingSessionEncryptedInputSchema matches Pick<FrontingSession, FrontingSessionEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof FrontingSessionEncryptedInputSchema>,
        Pick<FrontingSession, FrontingSessionEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });

  it("FrontingSessionEncryptedInput (canonical alias) matches Pick<FrontingSession, FrontingSessionEncryptedFields>", () => {
    expectTypeOf<
      Equal<FrontingSessionEncryptedInput, Pick<FrontingSession, FrontingSessionEncryptedFields>>
    >().toEqualTypeOf<true>();
  });
});
