/**
 * Zod parity check: `z.infer<typeof InnerWorldRegionEncryptedInputSchema>`
 * structurally matches `Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>`
 * — the canonical pre-encryption projection derived from the domain type.
 *
 * Catches drift between the Zod schema and the domain type's encrypted
 * field keys (e.g. renaming `accessType` on one side but not the other).
 */

import { describe, expectTypeOf, it } from "vitest";

import type { InnerWorldRegionEncryptedInputSchema } from "../../innerworld.js";
import type { Equal, InnerWorldRegion, InnerWorldRegionEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("InnerWorldRegion Zod parity", () => {
  it("InnerWorldRegionEncryptedInputSchema matches Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof InnerWorldRegionEncryptedInputSchema>,
        Pick<InnerWorldRegion, InnerWorldRegionEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
