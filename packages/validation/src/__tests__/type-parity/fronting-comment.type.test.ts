/**
 * Zod parity check: `z.infer<typeof FrontingCommentEncryptedInputSchema>` structurally
 * matches `Pick<FrontingComment, FrontingCommentEncryptedFields>` — the canonical
 * pre-encryption projection derived from the domain type.
 *
 * Asserts directly against `Pick<FrontingComment, FrontingCommentEncryptedFields>` (rather
 * than importing `FrontingCommentEncryptedInput` from `@pluralscape/data`) to avoid creating
 * a reverse dependency from validation → data.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { FrontingCommentEncryptedInputSchema } from "../../fronting-comment.js";
import type { Equal, FrontingComment, FrontingCommentEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingComment Zod parity", () => {
  it("FrontingCommentEncryptedInputSchema matches Pick<FrontingComment, FrontingCommentEncryptedFields>", () => {
    type Inferred = z.infer<typeof FrontingCommentEncryptedInputSchema>;
    type Expected = Pick<FrontingComment, FrontingCommentEncryptedFields>;
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });
});
