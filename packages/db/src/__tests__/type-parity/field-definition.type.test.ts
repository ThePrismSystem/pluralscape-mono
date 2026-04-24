/**
 * Drizzle parity check: the FieldDefinition row shape inferred from the
 * `field_definitions` table structurally matches
 * `FieldDefinitionServerMetadata` in @pluralscape/types. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { fieldDefinitions } from "../../schema/pg/custom-fields.js";

import type { Equal, FieldDefinitionServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FieldDefinition Drizzle parity", () => {
  it("field_definitions Drizzle row has the same property keys as FieldDefinitionServerMetadata", () => {
    type Row = InferSelectModel<typeof fieldDefinitions>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FieldDefinitionServerMetadata>();
  });

  it("field_definitions Drizzle row equals FieldDefinitionServerMetadata", () => {
    type Row = InferSelectModel<typeof fieldDefinitions>;
    expectTypeOf<Equal<Row, FieldDefinitionServerMetadata>>().toEqualTypeOf<true>();
  });
});
