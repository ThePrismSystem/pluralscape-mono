/**
 * Zod parity check: `z.infer<typeof RelationshipEncryptedInputSchema>`
 * structurally matches the canonical `RelationshipEncryptedInput` —
 * `{ label: string }` for custom variants and an empty object for standard
 * variants.
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  RelationshipEncryptedInputSchema,
  CustomRelationshipEncryptedSchema,
  StandardRelationshipEncryptedSchema,
} from "../../relationship.js";
import type { Equal, RelationshipEncryptedInput } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Relationship Zod parity", () => {
  it("RelationshipEncryptedInputSchema matches RelationshipEncryptedInput", () => {
    type Inferred = z.infer<typeof RelationshipEncryptedInputSchema>;
    expectTypeOf<Equal<Inferred, RelationshipEncryptedInput>>().toEqualTypeOf<true>();
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
