/**
 * Drizzle parity check: the SystemStructureEntityType row shape inferred
 * from the `system_structure_entity_types` table structurally matches
 * `SystemStructureEntityTypeServerMetadata` in @pluralscape/types.
 *
 * SystemStructureEntityType is an encrypted entity — its T1 fields (name,
 * description, color, imageSource, emoji) are bundled inside the
 * `encryptedData` column. The server-visible row is the domain projection
 * minus those fields plus the archivable metadata columns. See
 * `member.type.test.ts` for the general rationale behind the brand-stripped
 * comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemStructureEntityTypes } from "../../schema/pg/structure.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SystemStructureEntityTypeServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemStructureEntityType Drizzle parity", () => {
  it("system_structure_entity_types Drizzle row has the same property keys as SystemStructureEntityTypeServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntityTypes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemStructureEntityTypeServerMetadata>();
  });

  it("system_structure_entity_types Drizzle row equals SystemStructureEntityTypeServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof systemStructureEntityTypes>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SystemStructureEntityTypeServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
