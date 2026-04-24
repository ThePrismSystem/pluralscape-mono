/**
 * Drizzle parity check: the FieldDefinitionScope row shape inferred from
 * the `field_definition_scopes` table structurally matches
 * `FieldDefinitionScopeServerMetadata` in @pluralscape/types.
 *
 * FieldDefinitionScope is plaintext. The domain type is a minimal binding
 * record; the Drizzle row adds `systemId` plus standard audit/version
 * columns (captured in `FieldDefinitionScopeServerMetadata`). See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { fieldDefinitionScopes } from "../../schema/pg/custom-fields.js";

import type { Equal, FieldDefinitionScopeServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FieldDefinitionScope Drizzle parity", () => {
  it("field_definition_scopes Drizzle row has the same property keys as FieldDefinitionScopeServerMetadata", () => {
    type Row = InferSelectModel<typeof fieldDefinitionScopes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FieldDefinitionScopeServerMetadata>();
  });

  it("field_definition_scopes Drizzle row equals FieldDefinitionScopeServerMetadata", () => {
    type Row = InferSelectModel<typeof fieldDefinitionScopes>;
    expectTypeOf<Equal<Row, FieldDefinitionScopeServerMetadata>>().toEqualTypeOf<true>();
  });
});
