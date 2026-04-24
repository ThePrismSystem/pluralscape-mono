/**
 * Drizzle parity check: the JournalEntry row shape inferred from the
 * `journal_entries` table structurally matches `JournalEntryServerMetadata`
 * in @pluralscape/types.
 *
 * Hybrid entity: plaintext metadata (author, timestamps) + opaque
 * `encryptedData` (carries title, body, mood, tags).
 */

import { describe, expectTypeOf, it } from "vitest";

import { journalEntries } from "../../schema/pg/journal.js";

import type { Equal, JournalEntryServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("JournalEntry Drizzle parity", () => {
  it("journalEntries Drizzle row has the same property keys as JournalEntryServerMetadata", () => {
    type Row = InferSelectModel<typeof journalEntries>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof JournalEntryServerMetadata>();
  });

  it("journalEntries Drizzle row equals JournalEntryServerMetadata", () => {
    type Row = InferSelectModel<typeof journalEntries>;
    expectTypeOf<Equal<Row, JournalEntryServerMetadata>>().toEqualTypeOf<true>();
  });
});
