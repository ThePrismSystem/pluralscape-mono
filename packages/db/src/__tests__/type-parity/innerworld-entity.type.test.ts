/**
 * Drizzle parity check: the InnerWorldEntity row shape inferred from the
 * `innerworld_entities` table structurally matches
 * `InnerWorldEntityServerMetadata` in @pluralscape/types.
 *
 * `InnerWorldEntity` is a discriminated union (member / landmark /
 * structure-entity) — every encrypted field lives inside the blob, so
 * after distributively stripping them all three variants collapse to
 * the same plaintext residual (`id`, `systemId`, `regionId`, audit
 * metadata, archive state). That's what the Drizzle row exposes.
 */

import { describe, expectTypeOf, it } from "vitest";

import { innerworldEntities } from "../../schema/pg/innerworld.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, InnerWorldEntityServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("InnerWorldEntity Drizzle parity", () => {
  it("innerworld_entities Drizzle row has the same property keys as InnerWorldEntityServerMetadata", () => {
    type Row = InferSelectModel<typeof innerworldEntities>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof InnerWorldEntityServerMetadata>();
  });

  it("innerworld_entities Drizzle row equals InnerWorldEntityServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof innerworldEntities>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<InnerWorldEntityServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
