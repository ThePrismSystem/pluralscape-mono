import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

describe("PG migrations journal integrity", () => {
  const journalPath = resolve(__dirname, "../../migrations/pg/meta/_journal.json");
  const journal: Journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  it("has unique tags", () => {
    const tags = journal.entries.map((e) => e.tag);
    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBe(tags.length);
  });

  it("has unique idx values", () => {
    const idxs = journal.entries.map((e) => e.idx);
    const uniqueIdxs = new Set(idxs);
    expect(uniqueIdxs.size).toBe(idxs.length);
  });

  it("has sequential idx values starting at 0", () => {
    journal.entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
    });
  });
});

/**
 * Regression guard — each dialect's journal must reference only tags that
 * have a matching `.sql` file on disk. Catches regeneration drift where the
 * journal points at a tag whose file was never committed or was deleted.
 *
 * Note: on-disk `.sql` files without a journal entry are intentionally
 * allowed (e.g. PG's `0001_rls_all_tables.sql` is hand-maintained outside
 * drizzle-kit's journal).
 */
describe("migrations journal file-on-disk parity", () => {
  const dialects = ["pg", "sqlite"] as const;

  for (const dialect of dialects) {
    it(`every ${dialect} journal entry has a matching .sql file on disk`, () => {
      const journalPath = resolve(__dirname, `../../migrations/${dialect}/meta/_journal.json`);
      const journal: Journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
      for (const entry of journal.entries) {
        const sqlPath = resolve(__dirname, `../../migrations/${dialect}/${entry.tag}.sql`);
        expect(existsSync(sqlPath)).toBe(true);
      }
    });
  }
});
