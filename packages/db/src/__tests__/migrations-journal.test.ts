import { readFileSync } from "node:fs";
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
