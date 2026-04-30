/**
 * Row transform tests for document-shaped entities: notes, journal entries,
 * and wiki pages.
 *
 * Covers: rowToNote (+ edge branches), rowToJournalEntry (+ edge branches),
 *         rowToWikiPage
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-member-fronting.test.ts,
 *                  row-transforms-comms.test.ts,
 *                  row-transforms-structure-innerworld.test.ts,
 *                  row-transforms-lifecycle-fields.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  rowToJournalEntry,
  rowToNote,
  rowToWikiPage,
} from "../../row-transforms/index.js";

// ── rowToNote ─────────────────────────────────────────────────────────────────

describe("rowToNote", () => {
  function baseNoteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "note-1",
      system_id: "sys-1",
      author_entity_type: "member",
      author_entity_id: "mem-1",
      title: "My Note",
      content: "Some content",
      background_color: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps note row — builds EntityReference from author_entity_type + author_entity_id", () => {
    const row: Record<string, unknown> = {
      id: "note-1",
      system_id: "sys-1",
      author_entity_type: "member",
      author_entity_id: "mem-1",
      title: "Shopping list",
      content: "Eggs, milk, bread",
      background_color: "#ffffcc",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToNote(row);

    expect(result.id).toBe("note-1");
    expect(result.author).toEqual({ entityType: "member", entityId: "mem-1" });
    expect(result.title).toBe("Shopping list");
    expect(result.content).toBe("Eggs, milk, bread");
    expect(result.backgroundColor).toBe("#ffffcc");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived note row", () => {
    const result = rowToNote(baseNoteRow());
    expect(result.id).toBe("note-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.author).toEqual({ entityType: "member", entityId: "mem-1" });
    expect(result.title).toBe("My Note");
    expect(result.content).toBe("Some content");
    expect(result.backgroundColor).toBeNull();
    expect(result.archived).toBe(false);
  });

  it("returns null author when both author fields are null", () => {
    const row: Record<string, unknown> = {
      id: "note-2",
      system_id: "sys-1",
      author_entity_type: null,
      author_entity_id: null,
      title: "Anonymous note",
      content: "Content",
      background_color: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToNote(row);
    expect(result.author).toBeNull();
  });

  it("returns archived note when archived = 1", () => {
    const result = rowToNote(baseNoteRow({ archived: 1, updated_at: 1_700_000_444_000 }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_444_000);
    }
  });

  it("supports null author fields", () => {
    const result = rowToNote(baseNoteRow({ author_entity_type: null, author_entity_id: null }));
    expect(result.author).toBeNull();
  });

  it("populates backgroundColor when provided", () => {
    const result = rowToNote(baseNoteRow({ background_color: "yellow" }));
    expect(result.backgroundColor).toBe("yellow");
  });
});

// ── rowToJournalEntry ─────────────────────────────────────────────────────────

describe("rowToJournalEntry", () => {
  it("maps a journal entry row with JSON-serialized blocks", () => {
    const row: Record<string, unknown> = {
      id: "je-1",
      system_id: "sys-1",
      author: "mem-1",
      fronting_session_id: null,
      title: "First entry",
      blocks: '[{"type":"paragraph","text":"Hello"}]',
      tags: '["mood","daily"]',
      linked_entities: "[]",
      fronting_snapshots: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToJournalEntry(row);

    expect(result.id).toBe("je-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.author).toEqual({ entityType: "member", entityId: "mem-1" });
    expect(result.frontingSessionId).toBeNull();
    expect(result.title).toBe("First entry");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Hello" }]);
    expect(result.tags).toEqual(["mood", "daily"]);
    expect(result.linkedEntities).toEqual([]);
    expect(result.frontingSnapshots).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("returns null author when author column is null", () => {
    const row: Record<string, unknown> = {
      id: "je-2",
      system_id: "sys-1",
      author: null,
      fronting_session_id: null,
      title: "Anonymous entry",
      blocks: "[]",
      tags: "[]",
      linked_entities: "[]",
      fronting_snapshots: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToJournalEntry(row);
    expect(result.author).toBeNull();
  });
});

describe("rowToJournalEntry edge branches", () => {
  it("returns archived journal entry when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "je-arch",
      system_id: "sys-1",
      author: "mem-1",
      fronting_session_id: "fs-1",
      title: "Archived entry",
      blocks: "[]",
      tags: "[]",
      linked_entities: "[]",
      fronting_snapshots: '[{"memberId":"mem-1"}]',
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_666_000,
    };
    const result = rowToJournalEntry(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_666_000);
    }
  });
});

// ── rowToWikiPage ─────────────────────────────────────────────────────────────

describe("rowToWikiPage", () => {
  function baseWikiRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "wiki-1",
      system_id: "sys-1",
      title: "Welcome",
      slug: "welcome",
      blocks: '[{"type":"paragraph","text":"Hi"}]',
      linked_from_pages: '["wiki-2"]',
      tags: '["intro"]',
      linked_entities: "[]",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps wiki page row with JSON blocks", () => {
    const row: Record<string, unknown> = {
      id: "wp-1",
      system_id: "sys-1",
      title: "System Overview",
      slug: "system-overview",
      blocks: '[{"type":"heading","text":"Hello"}]',
      linked_from_pages: '["wp-2"]',
      tags: '["overview"]',
      linked_entities: "[]",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToWikiPage(row);

    expect(result.id).toBe("wp-1");
    expect(result.title).toBe("System Overview");
    expect(result.slug).toBe("system-overview");
    expect(result.blocks).toEqual([{ type: "heading", text: "Hello" }]);
    expect(result.linkedFromPages).toEqual(["wp-2"]);
    expect(result.tags).toEqual(["overview"]);
    expect(result.linkedEntities).toEqual([]);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived wiki page row", () => {
    const result = rowToWikiPage(baseWikiRow());
    expect(result.id).toBe("wiki-1");
    expect(result.title).toBe("Welcome");
    expect(result.slug).toBe("welcome");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Hi" }]);
    expect(result.linkedFromPages).toEqual(["wiki-2"]);
    expect(result.tags).toEqual(["intro"]);
    expect(result.linkedEntities).toEqual([]);
    expect(result.archived).toBe(false);
  });

  it("returns archived wiki page when archived = 1", () => {
    const result = rowToWikiPage(baseWikiRow({ archived: 1, updated_at: 1_700_000_333_000 }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_333_000);
    }
  });
});
