/**
 * Zod parity check: `z.infer<typeof StructureEntityEncryptedInputSchema>`
 * structurally matches `Pick<SystemStructureEntity,
 * SystemStructureEntityEncryptedFields>` — the pre-encryption contract.
 *
 * Catches drift between the Zod schema and the canonical domain type.
 * See ADR-023.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { StructureEntityEncryptedInputSchema } from "../../structure.js";
import type {
  Equal,
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("SystemStructureEntity Zod parity", () => {
  it("StructureEntityEncryptedInputSchema matches Pick (SystemStructureEntity, EncryptedFields)", () => {
    // Mirrors `StructureEntityEncryptedInput` in `@pluralscape/data`
    // without creating a reverse dependency from validation → data.
    expectTypeOf<
      Equal<
        z.infer<typeof StructureEntityEncryptedInputSchema>,
        Pick<SystemStructureEntity, SystemStructureEntityEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
