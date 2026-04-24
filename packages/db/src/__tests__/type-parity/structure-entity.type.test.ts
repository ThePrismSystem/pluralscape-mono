/**
 * Drizzle parity check: the SystemStructureEntity row shape inferred
 * from the `system_structure_entities` table structurally matches
 * `SystemStructureEntityServerMetadata` in @pluralscape/types.
 *
 * SystemStructureEntity is an encrypted entity — its T1 fields (name,
 * description, color, imageSource, emoji) are bundled inside the
 * `encryptedData` column. The server-visible row keeps the plaintext
 * columns (id, systemId, entityTypeId, sortOrder) plus the archivable
 * metadata. See `member.type.test.ts` for the general rationale behind
 * the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemStructureEntities } from "../../schema/pg/structure.js";

import type { Equal, SystemStructureEntityServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemStructureEntity Drizzle parity", () => {
  it("system_structure_entities Drizzle row has the same property keys as SystemStructureEntityServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntities>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemStructureEntityServerMetadata>();
  });

  it("system_structure_entities Drizzle row equals SystemStructureEntityServerMetadata", () => {
    type Row = InferSelectModel<typeof systemStructureEntities>;
    expectTypeOf<Equal<Row, SystemStructureEntityServerMetadata>>().toEqualTypeOf<true>();
  });
});
