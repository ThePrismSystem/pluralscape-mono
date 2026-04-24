/**
 * Drizzle parity check: the FrontingComment row shape inferred from the
 * `fronting_comments` table structurally matches
 * `FrontingCommentServerMetadata` in @pluralscape/types.
 *
 * FrontingComment is an encrypted entity with a single encrypted field
 * (`content`). The server metadata carries `sessionStartTime` —
 * denormalized from the parent fronting session to support the composite
 * FK into the partitioned `fronting_sessions` table (ADR 019). See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { frontingComments } from "../../schema/pg/fronting.js";

import type { Equal, FrontingCommentServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FrontingComment Drizzle parity", () => {
  it("fronting_comments Drizzle row has the same property keys as FrontingCommentServerMetadata", () => {
    type Row = InferSelectModel<typeof frontingComments>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FrontingCommentServerMetadata>();
  });

  it("fronting_comments Drizzle row equals FrontingCommentServerMetadata", () => {
    type Row = InferSelectModel<typeof frontingComments>;
    expectTypeOf<Equal<Row, FrontingCommentServerMetadata>>().toEqualTypeOf<true>();
  });
});
