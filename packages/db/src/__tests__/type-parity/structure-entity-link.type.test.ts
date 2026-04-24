/**
 * Drizzle parity check: the SystemStructureEntityLink row shape inferred
 * from the `system_structure_entity_links` table structurally matches
 * `SystemStructureEntityLinkServerMetadata` (identity alias for the
 * domain type) in @pluralscape/types.
 *
 * Plaintext entity — the server sees the same shape the client does; no
 * `encryptedData` column, no archive metadata, no `<X>EncryptedFields`
 * union. Entity + parent entity IDs are concrete
 * `SystemStructureEntityId`, enforced by composite FKs back to
 * `systemStructureEntities`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemStructureEntityLinks } from "../../schema/pg/structure.js";

import type { Equal, SystemStructureEntityLinkServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemStructureEntityLink Drizzle parity", () => {
  it("system_structure_entity_links Drizzle row has the same property keys as SystemStructureEntityLinkServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntityLinks>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemStructureEntityLinkServerMetadata>();
  });

  it("system_structure_entity_links Drizzle row equals SystemStructureEntityLinkServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntityLinks>;
    expectTypeOf<Equal<Row, SystemStructureEntityLinkServerMetadata>>().toEqualTypeOf<true>();
  });
});
