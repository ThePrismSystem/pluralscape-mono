/**
 * Zod parity check: `z.infer<typeof RelationshipEncryptedInputSchema>`
 * structurally matches `RelationshipEncryptedInput` — the distributive Pick
 * that yields `{ label: string }` for custom variants and `{}` for standard
 * variants. Asserts directly against the distributive Pick expression
 * (rather than importing `RelationshipEncryptedInput` from `@pluralscape/data`)
 * to avoid a reverse dependency from validation → data.
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  RelationshipEncryptedInputSchema,
  CustomRelationshipEncryptedSchema,
  StandardRelationshipEncryptedSchema,
} from "../../relationship.js";
import type { Equal, Relationship, RelationshipEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Relationship Zod parity", () => {
  it("RelationshipEncryptedInputSchema matches distributive RelationshipEncryptedInput", () => {
    type Inferred = z.infer<typeof RelationshipEncryptedInputSchema>;
    // Distributive Pick: `{ label: string }` for custom, `{}` for standard
    type Expected = Relationship extends unknown
      ? Pick<Relationship, Extract<keyof Relationship, RelationshipEncryptedFields>>
      : never;
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });

  it("CustomRelationshipEncryptedSchema has required label: string", () => {
    type Inferred = z.infer<typeof CustomRelationshipEncryptedSchema>;
    expectTypeOf<Equal<Inferred, { readonly label: string }>>().toEqualTypeOf<true>();
  });

  it("StandardRelationshipEncryptedSchema is an empty object", () => {
    type Inferred = z.infer<typeof StandardRelationshipEncryptedSchema>;
    expectTypeOf<Equal<Inferred, Record<string, never>>>().toEqualTypeOf<true>();
  });
});
