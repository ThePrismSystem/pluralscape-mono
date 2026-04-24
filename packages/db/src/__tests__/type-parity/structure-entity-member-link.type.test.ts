/**
 * Drizzle parity check: the SystemStructureEntityMemberLink row shape
 * inferred from the `system_structure_entity_member_links` table
 * structurally matches `SystemStructureEntityMemberLinkServerMetadata`
 * (identity alias for the domain type) in @pluralscape/types.
 *
 * Plaintext entity — the server sees the same shape the client does; no
 * `encryptedData` column, no archive metadata.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemStructureEntityMemberLinks } from "../../schema/pg/structure.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SystemStructureEntityMemberLinkServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemStructureEntityMemberLink Drizzle parity", () => {
  it("system_structure_entity_member_links Drizzle row has the same property keys as SystemStructureEntityMemberLinkServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntityMemberLinks>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemStructureEntityMemberLinkServerMetadata>();
  });

  it("system_structure_entity_member_links Drizzle row equals SystemStructureEntityMemberLinkServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof systemStructureEntityMemberLinks>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SystemStructureEntityMemberLinkServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
