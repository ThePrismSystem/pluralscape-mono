/**
 * Zod parity check: `z.infer<typeof RelationshipEncryptedInputSchema>`
 * structurally matches `Pick<Relationship, RelationshipEncryptedFields>` —
 * the canonical pre-encryption projection derived from the domain type.
 *
 * Asserts directly against `Pick<Relationship, RelationshipEncryptedFields>`
 * (rather than importing `RelationshipEncryptedInput` from
 * `@pluralscape/data`) to avoid creating a reverse dependency from
 * validation → data.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { RelationshipEncryptedInputSchema } from "../../relationship.js";
import type { Equal, Relationship, RelationshipEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Relationship Zod parity", () => {
  it("RelationshipEncryptedInputSchema matches Pick<Relationship, RelationshipEncryptedFields>", () => {
    type Inferred = z.infer<typeof RelationshipEncryptedInputSchema>;
    type Expected = Pick<Relationship, RelationshipEncryptedFields>;
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });
});
