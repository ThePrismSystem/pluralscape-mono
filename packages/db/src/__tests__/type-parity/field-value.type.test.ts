/**
 * Drizzle parity check: the FieldValue row shape inferred from the
 * `field_values` table structurally matches `FieldValueServerMetadata`
 * in @pluralscape/types.
 *
 * FieldValue has three mutually-exclusive scope columns (memberId,
 * structureEntityId, groupId) — a CHECK constraint at the DB layer
 * enforces exactly one is non-null. The server metadata reflects each
 * nullable column directly; no polymorphic `entity_id`/`entity_type`
 * collapse. See `member.type.test.ts` for the general rationale behind
 * the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { fieldValues } from "../../schema/pg/custom-fields.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, FieldValueServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FieldValue Drizzle parity", () => {
  it("field_values Drizzle row has the same property keys as FieldValueServerMetadata", () => {
    type Row = InferSelectModel<typeof fieldValues>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FieldValueServerMetadata>();
  });

  it("field_values Drizzle row equals FieldValueServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof fieldValues>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<FieldValueServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
