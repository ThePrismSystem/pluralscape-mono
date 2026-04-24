/**
 * Zod parity check: `z.infer<typeof GroupEncryptedInputSchema>` structurally
 * matches `Pick<Group, GroupEncryptedFields>` — the canonical pre-encryption
 * projection derived from the domain type.
 *
 * Asserts directly against `Pick<Group, GroupEncryptedFields>` (rather than
 * importing `GroupEncryptedInput` from `@pluralscape/data`) to avoid creating
 * a reverse dependency from validation → data.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { GroupEncryptedInputSchema } from "../../group.js";
import type { Equal, Group, GroupEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Group Zod parity", () => {
  it("GroupEncryptedInputSchema matches Pick<Group, GroupEncryptedFields>", () => {
    type Inferred = z.infer<typeof GroupEncryptedInputSchema>;
    type Expected = Pick<Group, GroupEncryptedFields>;
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });
});
