/**
 * Drizzle parity check: the Relationship row shape inferred from the
 * `relationships` table structurally matches `RelationshipServerMetadata`
 * in @pluralscape/types.
 *
 * `RelationshipServerMetadata` strips the encrypted field keys from the
 * domain (`encryptedData` may be nullable for relationships that carry no
 * ciphertext payload) and `archived` (server tracks a mutable boolean with
 * a companion `archivedAt` timestamp). Relationships only expose
 * `createdAt` on the domain; the DB row adds `updatedAt`/`version`/
 * `archived`/`archivedAt` on top.
 */

import { describe, expectTypeOf, it } from "vitest";

import { relationships } from "../../schema/pg/structure.js";

import type { Equal, RelationshipServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Relationship Drizzle parity", () => {
  it("relationships Drizzle row has the same property keys as RelationshipServerMetadata", () => {
    type Row = InferSelectModel<typeof relationships>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof RelationshipServerMetadata>();
  });

  it("relationships Drizzle row equals RelationshipServerMetadata", () => {
    type Row = InferSelectModel<typeof relationships>;
    expectTypeOf<Equal<Row, RelationshipServerMetadata>>().toEqualTypeOf<true>();
  });
});
