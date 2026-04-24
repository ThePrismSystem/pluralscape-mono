/**
 * Zod parity check: `z.infer<typeof StructureEntityTypeEncryptedInputSchema>`
 * structurally matches `Pick<SystemStructureEntityType,
 * SystemStructureEntityTypeEncryptedFields>` — the pre-encryption contract.
 *
 * Catches drift between the Zod schema and the canonical domain type.
 * See ADR-023.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { StructureEntityTypeEncryptedInputSchema } from "../../structure.js";
import type {
  Equal,
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("SystemStructureEntityType Zod parity", () => {
  it("StructureEntityTypeEncryptedInputSchema matches Pick (SystemStructureEntityType, EncryptedFields)", () => {
    // Mirrors `StructureEntityTypeEncryptedInput` in `@pluralscape/data`
    // without creating a reverse dependency from validation → data.
    expectTypeOf<
      Equal<
        z.infer<typeof StructureEntityTypeEncryptedInputSchema>,
        Pick<SystemStructureEntityType, SystemStructureEntityTypeEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
