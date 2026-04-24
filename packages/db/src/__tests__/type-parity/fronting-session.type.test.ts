/**
 * Drizzle parity check: the FrontingSession row shape inferred from the
 * `fronting_sessions` table structurally matches
 * `FrontingSessionServerMetadata` in @pluralscape/types.
 *
 * FrontingSession is a discriminated union (`ActiveFrontingSession |
 * CompletedFrontingSession`) in the domain; the DB stores both variants
 * in one row with a nullable `endTime`. `FrontingSessionServerMetadata`
 * collapses the union by stripping `endTime` from the distributive Omit
 * (the two variants become identical) and re-adds a single nullable
 * column. See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { frontingSessions } from "../../schema/pg/fronting.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, FrontingSessionServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FrontingSession Drizzle parity", () => {
  it("fronting_sessions Drizzle row has the same property keys as FrontingSessionServerMetadata", () => {
    type Row = InferSelectModel<typeof frontingSessions>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FrontingSessionServerMetadata>();
  });

  it("fronting_sessions Drizzle row equals FrontingSessionServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof frontingSessions>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<FrontingSessionServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
