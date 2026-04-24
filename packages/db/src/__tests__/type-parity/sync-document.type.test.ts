/**
 * Drizzle parity check: the sync_documents row shape inferred from the
 * `sync_documents` table structurally matches `SyncDocument` in
 * @pluralscape/types.
 *
 * SyncDocument is a plaintext entity — the document metadata the sync
 * engine reads at the server layer is exactly the shape exposed on the
 * domain (no server-only columns). Parity is asserted against the
 * domain type directly. See `member.type.test.ts` for the general
 * rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { syncDocuments } from "../../schema/pg/sync.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SyncDocument } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SyncDocument Drizzle parity", () => {
  it("sync_documents Drizzle row has the same property keys as SyncDocument", () => {
    type Row = InferSelectModel<typeof syncDocuments>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SyncDocument>();
  });

  it("sync_documents Drizzle row equals SyncDocument modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof syncDocuments>;
    expectTypeOf<Equal<StripBrands<Row>, StripBrands<SyncDocument>>>().toEqualTypeOf<true>();
  });
});
