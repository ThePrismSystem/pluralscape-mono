/**
 * Zod parity check: `z.infer<typeof CustomFrontEncryptedInputSchema>`
 * structurally matches `Pick<CustomFront, CustomFrontEncryptedFields>` —
 * the canonical pre-encryption projection derived from the domain type.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { CustomFrontEncryptedInputSchema } from "../../custom-front.js";
import type { CustomFront, CustomFrontEncryptedFields, Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("CustomFront Zod parity", () => {
  it("CustomFrontEncryptedInputSchema matches Pick<CustomFront, CustomFrontEncryptedFields>", () => {
    type Inferred = z.infer<typeof CustomFrontEncryptedInputSchema>;
    type Expected = Pick<CustomFront, CustomFrontEncryptedFields>;
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });
});
