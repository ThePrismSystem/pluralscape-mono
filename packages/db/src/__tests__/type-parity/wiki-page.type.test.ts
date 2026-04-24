/**
 * Drizzle parity check: the WikiPage row shape inferred from the
 * `wiki_pages` table structurally matches `WikiPageServerMetadata` in
 * @pluralscape/types.
 *
 * Hybrid entity: plaintext metadata (slug/hierarchy) + opaque `encryptedData`
 * (carries title, body, tags).
 */

import { describe, expectTypeOf, it } from "vitest";

import { wikiPages } from "../../schema/pg/journal.js";

import type { Equal, WikiPageServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("WikiPage Drizzle parity", () => {
  it("wikiPages Drizzle row has the same property keys as WikiPageServerMetadata", () => {
    type Row = InferSelectModel<typeof wikiPages>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof WikiPageServerMetadata>();
  });

  it("wikiPages Drizzle row equals WikiPageServerMetadata", () => {
    type Row = InferSelectModel<typeof wikiPages>;
    expectTypeOf<Equal<Row, WikiPageServerMetadata>>().toEqualTypeOf<true>();
  });
});
