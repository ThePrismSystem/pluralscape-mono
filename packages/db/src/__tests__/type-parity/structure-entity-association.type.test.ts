/**
 * Drizzle parity check: the SystemStructureEntityAssociation row shape
 * inferred from the `system_structure_entity_associations` table
 * structurally matches `SystemStructureEntityAssociationServerMetadata`
 * (identity alias for the domain type) in @pluralscape/types.
 *
 * Plaintext entity — the server sees the same shape the client does; no
 * `encryptedData` column, no archive metadata. Source/target entity IDs
 * are concrete (`SystemStructureEntityId`), enforced by the
 * (sourceEntityId, systemId) + (targetEntityId, systemId) composite FKs
 * back to `systemStructureEntities`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemStructureEntityAssociations } from "../../schema/pg/structure.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SystemStructureEntityAssociationServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemStructureEntityAssociation Drizzle parity", () => {
  it("system_structure_entity_associations Drizzle row has the same property keys as SystemStructureEntityAssociationServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntityAssociations>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemStructureEntityAssociationServerMetadata>();
  });

  it("system_structure_entity_associations Drizzle row equals SystemStructureEntityAssociationServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof systemStructureEntityAssociations>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SystemStructureEntityAssociationServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
