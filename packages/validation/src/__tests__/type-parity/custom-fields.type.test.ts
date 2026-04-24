/**
 * Zod parity check: `z.infer<typeof FieldDefinitionEncryptedInputSchema>`
 * and `z.infer<typeof FieldValueEncryptedInputSchema>` structurally match
 * their domain-type counterparts from `@pluralscape/types`.
 *
 * Catches drift between Zod validation schemas and the canonical domain
 * types. See ADR-023.
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  FieldDefinitionEncryptedInputSchema,
  FieldValueEncryptedInputSchema,
} from "../../custom-fields.js";
import type {
  Equal,
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldValueUnion,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Custom fields Zod parity", () => {
  it("FieldDefinitionEncryptedInputSchema matches Pick<FieldDefinition, FieldDefinitionEncryptedFields>", () => {
    // Mirrors `FieldDefinitionEncryptedInput` in `@pluralscape/data` without
    // creating a reverse dependency from validation → data.
    expectTypeOf<
      Equal<
        z.infer<typeof FieldDefinitionEncryptedInputSchema>,
        Pick<FieldDefinition, FieldDefinitionEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });

  it("FieldValueEncryptedInputSchema matches FieldValueUnion", () => {
    // FieldValue's encrypted payload carries the full discriminated union,
    // not just the outer `value` key — the Zod schema parses the whole
    // `{fieldType, value}` shape.
    expectTypeOf<
      Equal<z.infer<typeof FieldValueEncryptedInputSchema>, FieldValueUnion>
    >().toEqualTypeOf<true>();
  });
});
