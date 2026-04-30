/**
 * Row transform tests for miscellaneous entities: notes, journal entries, wiki pages,
 * lifecycle events, timers, check-in records, field definitions, field values,
 * friend codes, and system settings.
 *
 * Covers: rowToNote, rowToJournalEntry, rowToWikiPage, rowToLifecycleEvent,
 *         rowToTimer, rowToCheckInRecord, rowToFieldDefinition, rowToFieldValue,
 *         rowToFriendCode
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-member-fronting.test.ts,
 *                  row-transforms-comms.test.ts,
 *                  row-transforms-structure-innerworld.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  RowTransformError,
  rowToCheckInRecord,
  rowToFieldDefinition,
  rowToFieldValue,
  rowToFriendCode,
  rowToJournalEntry,
  rowToLifecycleEvent,
  rowToNote,
  rowToTimer,
  rowToWikiPage,
} from "../row-transforms/index.js";

import type { SystemId } from "@pluralscape/types";

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

// ── rowToLifecycleEvent ───────────────────────────────────────────────────────

describe("rowToLifecycleEvent", () => {
  it("maps lifecycle event row with JSON payload spread into result", () => {
    const row: Record<string, unknown> = {
      id: "le-1",
      system_id: "sys-1",
      event_type: "discovery",
      occurred_at: 1_700_000_000_000,
      recorded_at: 1_700_000_001_000,
      notes: "Found a new member",
      payload: '{"memberId":"mem-1"}',
      archived: 0,
    };

    const result = rowToLifecycleEvent(row);

    expect(result.id).toBe("le-1");
    expect(result.eventType).toBe("discovery");
    expect(result.occurredAt).toBe(1_700_000_000_000);
    expect(result.recordedAt).toBe(1_700_000_001_000);
    expect(result.notes).toBe("Found a new member");
    expect(result.archived).toBe(false);
  });

  it("returns archived lifecycle event when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "le-arch",
      system_id: "sys-1",
      event_type: "milestone",
      occurred_at: 1_700_000_000_000,
      recorded_at: 1_700_000_888_000,
      notes: null,
      payload: "{}",
      archived: 1,
    };
    const result = rowToLifecycleEvent(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_888_000);
    }
  });
});

// ── rowToTimer ────────────────────────────────────────────────────────────────

describe("rowToTimer", () => {
  function baseTimerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "tmr-1",
      system_id: "sys-1",
      interval_minutes: 60,
      waking_hours_only: 1,
      waking_start: "08:00",
      waking_end: "22:00",
      prompt_text: "How are you feeling?",
      enabled: 1,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps timer row with waking_hours_only and enabled booleans", () => {
    const result = rowToTimer(baseTimerRow());
    expect(result.id).toBe("tmr-1");
    expect(result.intervalMinutes).toBe(60);
    expect(result.wakingHoursOnly).toBe(true);
    expect(result.wakingStart).toBe("08:00");
    expect(result.wakingEnd).toBe("22:00");
    expect(result.promptText).toBe("How are you feeling?");
    expect(result.enabled).toBe(true);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("returns null wakingHoursOnly when source field is null", () => {
    const result = rowToTimer(baseTimerRow({ waking_hours_only: null }));
    expect(result.wakingHoursOnly).toBeNull();
  });

  it("returns null wakingHoursOnly when source field is undefined", () => {
    const row = baseTimerRow();
    delete row["waking_hours_only"];
    const result = rowToTimer(row);
    expect(result.wakingHoursOnly).toBeNull();
  });

  it("returns archived timer when archived = 1", () => {
    const result = rowToTimer(baseTimerRow({ archived: 1, updated_at: 1_700_000_555_000 }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_555_000);
    }
  });
});

// ── rowToCheckInRecord ────────────────────────────────────────────────────────

describe("rowToCheckInRecord", () => {
  function baseCheckInRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "cir-1",
      timer_config_id: "tmr-1",
      system_id: "sys-1",
      scheduled_at: 1_700_000_000_000,
      responded_by_member_id: "mem-1",
      responded_at: 1_700_000_001_000,
      dismissed: 0,
      archived: 0,
      archived_at: null,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
      ...overrides,
    };
  }

  it("maps check-in record row", () => {
    const result = rowToCheckInRecord(baseCheckInRow());
    expect(result.id).toBe("cir-1");
    expect(result.timerConfigId).toBe("tmr-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.scheduledAt).toBe(1_700_000_000_000);
    expect(result.respondedByMemberId).toBe("mem-1");
    expect(result.respondedAt).toBe(1_700_000_001_000);
    expect(result.dismissed).toBe(false);
    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
  });

  it("returns archived check-in with archivedAt from archived_at column", () => {
    const result = rowToCheckInRecord(
      baseCheckInRow({ archived: 1, archived_at: 1_700_000_999_000 }),
    );
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_999_000);
    }
  });

  it("falls back to updated_at when archived = 1 but archived_at is null", () => {
    const result = rowToCheckInRecord(
      baseCheckInRow({
        archived: 1,
        archived_at: null,
        updated_at: 1_700_000_222_000,
      }),
    );
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_222_000);
    }
  });

  it("supports null respondedByMemberId and respondedAt (unanswered)", () => {
    const result = rowToCheckInRecord(
      baseCheckInRow({ responded_by_member_id: null, responded_at: null }),
    );
    expect(result.respondedByMemberId).toBeNull();
    expect(result.respondedAt).toBeNull();
  });
});

// ── rowToFieldDefinition ──────────────────────────────────────────────────────

describe("rowToFieldDefinition", () => {
  it("maps field definition row with options JSON", () => {
    const row: Record<string, unknown> = {
      id: "fd-1",
      system_id: "sys-1",
      name: "Age Range",
      description: null,
      field_type: "select",
      options: '["0-10","11-17","18+"]',
      required: 0,
      sort_order: 2.0,
      scopes: '["member"]',
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFieldDefinition(row);

    expect(result.id).toBe("fd-1");
    expect(result.name).toBe("Age Range");
    expect(result.fieldType).toBe("select");
    expect(result.options).toEqual(["0-10", "11-17", "18+"]);
    expect(result.required).toBe(false);
    expect(result.sortOrder).toBe(2.0);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── rowToFieldValue ───────────────────────────────────────────────────────────

describe("rowToFieldValue", () => {
  it("maps field value row with JSON-serialized FieldValueUnion", () => {
    const row: Record<string, unknown> = {
      id: "fv-1",
      field_definition_id: "fd-1",
      member_id: "mem-1",
      structure_entity_id: null,
      group_id: null,
      value: '{"fieldType":"text","value":"18+"}',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFieldValue(row, "sys-1" as SystemId);

    expect(result.id).toBe("fv-1");
    expect(result.fieldDefinitionId).toBe("fd-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.structureEntityId).toBeNull();
    expect(result.groupId).toBeNull();
    expect(result.fieldType).toBe("text");
    expect(result.value).toBe("18+");
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.version).toBe(0);
  });

  it("throws RowTransformError when value JSON has no fieldType", () => {
    const row: Record<string, unknown> = {
      id: "fv-corrupt",
      field_definition_id: "fd-1",
      member_id: null,
      structure_entity_id: null,
      group_id: null,
      value: JSON.stringify({ value: "orphaned" }),
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };
    expect(() => rowToFieldValue(row, "sys-1" as SystemId)).toThrow(RowTransformError);
  });

  it("throws RowTransformError when value column is null", () => {
    const row: Record<string, unknown> = {
      id: "fv-null",
      field_definition_id: "fd-1",
      member_id: null,
      structure_entity_id: null,
      group_id: null,
      value: null,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };
    expect(() => rowToFieldValue(row, "sys-1" as SystemId)).toThrow(RowTransformError);
  });
});

// ── rowToFriendCode ───────────────────────────────────────────────────────────

describe("rowToFriendCode", () => {
  it("maps friend code row", () => {
    const row: Record<string, unknown> = {
      id: "frc-1",
      account_id: "acct-1",
      code: "ALPHA123",
      created_at: 1_700_000_000_000,
      expires_at: 1_700_086_400_000,
      archived: 0,
    };

    const result = rowToFriendCode(row);

    expect(result.id).toBe("frc-1");
    expect(result.accountId).toBe("acct-1");
    expect(result.code).toBe("ALPHA123");
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.expiresAt).toBe(1_700_086_400_000);
    expect(result.archived).toBe(false);
  });

  it("returns Archived<FriendCode> with archivedAt when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "frc-2",
      account_id: "acct-1",
      code: "OLD123",
      created_at: 1_700_000_000_000,
      expires_at: null,
      archived: 1,
    };

    const result = rowToFriendCode(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_000_000);
    }
  });
});
