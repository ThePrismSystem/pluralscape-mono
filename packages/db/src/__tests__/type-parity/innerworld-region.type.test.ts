/**
 * Drizzle parity check: the InnerWorldRegion row shape inferred from the
 * `innerworld_regions` table structurally matches
 * `InnerWorldRegionServerMetadata` in @pluralscape/types.
 *
 * `InnerWorldRegionServerMetadata` strips the domain's encrypted fields
 * (bundled into the `encrypted_data` blob) and swaps the domain's
 * `archived: false` literal for a mutable `archived: boolean` +
 * `archivedAt: UnixMillis | null` pair. See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { innerworldRegions } from "../../schema/pg/innerworld.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, InnerWorldRegionServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("InnerWorldRegion Drizzle parity", () => {
  it("innerworld_regions Drizzle row has the same property keys as InnerWorldRegionServerMetadata", () => {
    type Row = InferSelectModel<typeof innerworldRegions>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof InnerWorldRegionServerMetadata>();
  });

  it("innerworld_regions Drizzle row equals InnerWorldRegionServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof innerworldRegions>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<InnerWorldRegionServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
