import { describe, expect, it } from "vitest";

import {
  RowTransformError,
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBoolFailClosed,
  parseJsonSafe,
  rowToAcknowledgement,
  rowToBoardMessage,
  rowToChannel,
  rowToCheckInRecord,
  rowToCustomFront,
  rowToFieldDefinition,
  rowToFieldValue,
  rowToFriendCode,
  rowToFriendConnection,
  rowToFrontingComment,
  rowToFrontingReport,
  rowToFrontingSession,
  rowToGroup,
  rowToInnerWorldEntity,
  rowToInnerWorldRegion,
  rowToJournalEntry,
  rowToLifecycleEvent,
  rowToMember,
  rowToMessage,
  rowToNote,
  rowToPoll,
  rowToPrivacyBucket,
  rowToRelationship,
  rowToStructureEntity,
  rowToStructureEntityType,
  rowToSystemSettings,
  rowToTimer,
  rowToWikiPage,
} from "../row-transforms/index.js";

// ── Guarded primitive helpers ─────────────────────────────────────────────────

describe("RowTransformError", () => {
  it("captures table, field, and rowId context", () => {
    const err = new RowTransformError("members", "name", "mem-1", "expected string");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RowTransformError");
    expect(err.table).toBe("members");
    expect(err.field).toBe("name");
    expect(err.rowId).toBe("mem-1");
    expect(err.message).toBe("members.name (row mem-1): expected string");
  });

  it("formats message without rowId", () => {
    const err = new RowTransformError("members", "name", null, "bad");
    expect(err.message).toBe("members.name: bad");
  });
});

describe("intToBoolFailClosed", () => {
  it("returns true for null (fail-closed)", () => {
    expect(intToBoolFailClosed(null)).toBe(true);
  });

  it("returns true for undefined (fail-closed)", () => {
    expect(intToBoolFailClosed(undefined)).toBe(true);
  });

  it("returns false for 0", () => {
    expect(intToBoolFailClosed(0)).toBe(false);
  });

  it("returns true for 1", () => {
    expect(intToBoolFailClosed(1)).toBe(true);
  });

  it("returns true for boolean true", () => {
    expect(intToBoolFailClosed(true)).toBe(true);
  });

  it("returns false for boolean false", () => {
    expect(intToBoolFailClosed(false)).toBe(false);
  });
});

describe("parseJsonSafe", () => {
  it("parses valid JSON string", () => {
    expect(parseJsonSafe('["a","b"]', "t", "f")).toEqual(["a", "b"]);
  });

  it("returns null for null input", () => {
    expect(parseJsonSafe(null, "t", "f")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseJsonSafe(undefined, "t", "f")).toBeNull();
  });

  it("passes non-string values through", () => {
    expect(parseJsonSafe(42, "t", "f")).toBe(42);
  });

  it("throws RowTransformError for malformed JSON", () => {
    expect(() => parseJsonSafe("{broken", "members", "tags", "mem-1")).toThrow(RowTransformError);
  });

  it("includes table/field context in error", () => {
    try {
      parseJsonSafe("{broken", "members", "tags", "mem-1");
    } catch (e) {
      const rte = e as InstanceType<typeof RowTransformError>;
      expect(rte.table).toBe("members");
      expect(rte.field).toBe("tags");
      expect(rte.rowId).toBe("mem-1");
    }
  });

  it("truncates long values in error message", () => {
    const longJson = "{" + "x".repeat(200);
    try {
      parseJsonSafe(longJson, "t", "f");
    } catch (e) {
      expect((e as Error).message).toContain("…");
      expect((e as Error).message.length).toBeLessThan(200);
    }
  });
});

describe("guardedStr", () => {
  it("passes valid strings through", () => {
    expect(guardedStr("hello", "t", "f")).toBe("hello");
  });

  it("throws RowTransformError for numbers", () => {
    expect(() => guardedStr(123, "members", "name", "mem-1")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedStr(null, "members", "name")).toThrow(RowTransformError);
  });
});

describe("guardedNum", () => {
  it("passes valid numbers through", () => {
    expect(guardedNum(42, "t", "f")).toBe(42);
  });

  it("throws RowTransformError for strings", () => {
    expect(() => guardedNum("abc", "members", "sort_order")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedNum(null, "members", "sort_order")).toThrow(RowTransformError);
  });
});

describe("guardedToMs", () => {
  it("passes valid numbers as UnixMillis", () => {
    expect(guardedToMs(1_700_000_000_000, "t", "f")).toBe(1_700_000_000_000);
  });

  it("throws RowTransformError for strings", () => {
    expect(() => guardedToMs("abc", "members", "created_at")).toThrow(RowTransformError);
  });

  it("throws RowTransformError for null", () => {
    expect(() => guardedToMs(null, "members", "created_at")).toThrow(RowTransformError);
  });
});

// ── Helper: toMs ──────────────────────────────────────────────────────────────
// UnixMillis is a branded type, but for test assertions plain numeric equality works.

// ── member (system-core, encrypted in API, plaintext in SQLite) ───────────────

describe("rowToMember", () => {
  it("maps snake_case SQLite columns to camelCase and converts boolean integers", () => {
    const row: Record<string, unknown> = {
      id: "mem-1",
      system_id: "sys-1",
      name: "Alice",
      pronouns: '["she","her"]',
      description: "A member",
      avatar_source: null,
      colors: '["#ff0000"]',
      saturation_level: '{"kind":"known","level":"highly-elaborated"}',
      tags: "[]",
      suppress_friend_front_notification: 0,
      board_message_notification_on_front: 1,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToMember(row);

    expect(result.id).toBe("mem-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("Alice");
    expect(result.pronouns).toEqual(["she", "her"]);
    expect(result.description).toBe("A member");
    expect(result.avatarSource).toBeNull();
    expect(result.colors).toEqual(["#ff0000"]);
    expect(result.suppressFriendFrontNotification).toBe(false);
    expect(result.boardMessageNotificationOnFront).toBe(true);
    expect(result.archived).toBe(false);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_001_000);
    expect(result.version).toBe(0);
  });

  it("returns Archived<Member> with archivedAt when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "mem-2",
      system_id: "sys-1",
      name: "Bob",
      pronouns: '["they","them"]',
      description: null,
      avatar_source: null,
      colors: "[]",
      saturation_level: '{"kind":"known","level":"fragment"}',
      tags: "[]",
      suppress_friend_front_notification: 0,
      board_message_notification_on_front: 0,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToMember(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_001_000);
    }
  });
});

// ── fronting-session (fronting, encrypted in API, plaintext in SQLite) ────────

describe("rowToFrontingSession", () => {
  it("maps a complete fronting session row", () => {
    const row: Record<string, unknown> = {
      id: "fs-1",
      system_id: "sys-1",
      member_id: "mem-1",
      start_time: 1_700_000_000_000,
      end_time: 1_700_000_003_600_000,
      comment: "Switched for task",
      custom_front_id: null,
      structure_entity_id: null,
      positionality: "fronting",
      outtrigger: null,
      outtrigger_sentiment: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFrontingSession(row);

    expect(result.id).toBe("fs-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.startTime).toBe(1_700_000_000_000);
    expect(result.endTime).toBe(1_700_000_003_600_000);
    expect(result.comment).toBe("Switched for task");
    expect(result.customFrontId).toBeNull();
    expect(result.structureEntityId).toBeNull();
    expect(result.positionality).toBe("fronting");
    expect(result.outtrigger).toBeNull();
    expect(result.outtriggerSentiment).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("handles null end_time for active sessions", () => {
    const row: Record<string, unknown> = {
      id: "fs-2",
      system_id: "sys-1",
      member_id: "mem-1",
      start_time: 1_700_000_000_000,
      end_time: null,
      comment: null,
      custom_front_id: null,
      structure_entity_id: null,
      positionality: null,
      outtrigger: null,
      outtrigger_sentiment: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFrontingSession(row);
    expect(result.endTime).toBeNull();
  });
});

// ── message (chat, encrypted in API, plaintext in SQLite) ─────────────────────

describe("rowToMessage", () => {
  it("maps a chat message row with JSON arrays", () => {
    const row: Record<string, unknown> = {
      id: "msg-1",
      channel_id: "chan-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Hello world",
      attachments: '["blob-1"]',
      mentions: '["mem-2"]',
      reply_to_id: null,
      timestamp: 1_700_000_000_000,
      edited_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToMessage(row);

    expect(result.id).toBe("msg-1");
    expect(result.channelId).toBe("chan-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Hello world");
    expect(result.attachments).toEqual(["blob-1"]);
    expect(result.mentions).toEqual(["mem-2"]);
    expect(result.replyToId).toBeNull();
    expect(result.timestamp).toBe(1_700_000_000_000);
    expect(result.editedAt).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── journal-entry (journal document) ──────────────────────────────────────────

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

// ── privacy-bucket / bucket (privacy-config, boolean archived) ────────────────

describe("rowToPrivacyBucket", () => {
  it("maps bucket row to PrivacyBucket domain type", () => {
    const row: Record<string, unknown> = {
      id: "bkt-1",
      system_id: "sys-1",
      name: "Friends Only",
      description: "Visible to close friends",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToPrivacyBucket(row);

    expect(result.id).toBe("bkt-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("Friends Only");
    expect(result.description).toBe("Visible to close friends");
    expect(result.archived).toBe(false);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_000_000);
    expect(result.version).toBe(0);
  });

  it("returns Archived<PrivacyBucket> with archivedAt when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "bkt-2",
      system_id: "sys-1",
      name: "Old bucket",
      description: null,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToPrivacyBucket(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_001_000);
    }
  });
});

// ── friend-connection (privacy-config, no encryption) ────────────────────────

describe("rowToFriendConnection", () => {
  it("maps friend connection row with JSON-serialized arrays", () => {
    const row: Record<string, unknown> = {
      id: "fc-1",
      account_id: "acct-1",
      friend_account_id: "acct-2",
      status: "accepted",
      assigned_buckets: '["bkt-1","bkt-2"]',
      visibility:
        '{"showMembers":true,"showGroups":true,"showStructure":false,"allowFrontingNotifications":true}',
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFriendConnection(row);

    expect(result.id).toBe("fc-1");
    expect(result.accountId).toBe("acct-1");
    expect(result.friendAccountId).toBe("acct-2");
    expect(result.status).toBe("accepted");
    expect(result.assignedBucketIds).toEqual(["bkt-1", "bkt-2"]);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── group (system-core, encrypted in API, boolean archived) ──────────────────

describe("rowToGroup", () => {
  it("maps group row with nullable fields", () => {
    const row: Record<string, unknown> = {
      id: "grp-1",
      system_id: "sys-1",
      name: "The Council",
      description: "Main group",
      parent_group_id: null,
      image_source: null,
      color: "#3344ff",
      emoji: "✨",
      sort_order: 1.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToGroup(row);

    expect(result.id).toBe("grp-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("The Council");
    expect(result.description).toBe("Main group");
    expect(result.parentGroupId).toBeNull();
    expect(result.imageSource).toBeNull();
    expect(result.color).toBe("#3344ff");
    expect(result.emoji).toBe("✨");
    expect(result.sortOrder).toBe(1.0);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── channel (chat, boolean archived) ─────────────────────────────────────────

describe("rowToChannel", () => {
  it("maps channel row", () => {
    const row: Record<string, unknown> = {
      id: "chan-1",
      system_id: "sys-1",
      name: "General",
      type: "text",
      parent_id: null,
      sort_order: 0.5,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToChannel(row);

    expect(result.id).toBe("chan-1");
    expect(result.name).toBe("General");
    expect(result.type).toBe("text");
    expect(result.parentId).toBeNull();
    expect(result.sortOrder).toBe(0.5);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── custom-front (system-core, boolean archived) ──────────────────────────────

describe("rowToCustomFront", () => {
  it("maps custom front row", () => {
    const row: Record<string, unknown> = {
      id: "cf-1",
      system_id: "sys-1",
      name: "Dissociated",
      description: "Floaty headspace",
      color: "#aabbcc",
      emoji: "🌫️",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToCustomFront(row);

    expect(result.id).toBe("cf-1");
    expect(result.name).toBe("Dissociated");
    expect(result.description).toBe("Floaty headspace");
    expect(result.color).toBe("#aabbcc");
    expect(result.emoji).toBe("🌫️");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── board-message (chat, boolean archived, pinned) ────────────────────────────

describe("rowToBoardMessage", () => {
  it("maps board message row with boolean pinned", () => {
    const row: Record<string, unknown> = {
      id: "bm-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Welcome!",
      pinned: 1,
      sort_order: 1.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToBoardMessage(row);

    expect(result.id).toBe("bm-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Welcome!");
    expect(result.pinned).toBe(true);
    expect(result.sortOrder).toBe(1.0);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── poll (chat, multiple boolean columns) ─────────────────────────────────────

describe("rowToPoll", () => {
  it("maps poll row with multiple boolean fields", () => {
    const row: Record<string, unknown> = {
      id: "poll-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      title: "Which day?",
      description: null,
      kind: "standard",
      status: "open",
      closed_at: null,
      ends_at: null,
      allow_multiple_votes: 0,
      max_votes_per_member: 1,
      allow_abstain: 1,
      allow_veto: 0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToPoll(row);

    expect(result.id).toBe("poll-1");
    expect(result.title).toBe("Which day?");
    expect(result.kind).toBe("standard");
    expect(result.status).toBe("open");
    expect(result.allowMultipleVotes).toBe(false);
    expect(result.maxVotesPerMember).toBe(1);
    expect(result.allowAbstain).toBe(true);
    expect(result.allowVeto).toBe(false);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── acknowledgement (chat, confirmed boolean) ─────────────────────────────────

describe("rowToAcknowledgement", () => {
  it("maps acknowledgement row with confirmed boolean", () => {
    const row: Record<string, unknown> = {
      id: "ack-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      target_member_id: "mem-2",
      message: "Are you okay?",
      confirmed: 0,
      confirmed_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToAcknowledgement(row);

    expect(result.id).toBe("ack-1");
    expect(result.createdByMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.message).toBe("Are you okay?");
    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── relationship (system-core, boolean bidirectional) ─────────────────────────

describe("rowToRelationship", () => {
  it("maps relationship row with bidirectional boolean", () => {
    const row: Record<string, unknown> = {
      id: "rel-1",
      system_id: "sys-1",
      source_member_id: "mem-1",
      target_member_id: "mem-2",
      type: "sibling",
      label: "Twin",
      bidirectional: 1,
      created_at: 1_700_000_000_000,
      archived: 0,
    };

    const result = rowToRelationship(row);

    expect(result.id).toBe("rel-1");
    expect(result.sourceMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.type).toBe("sibling");
    expect(result.label).toBe("Twin");
    expect(result.bidirectional).toBe(true);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.archived).toBe(false);
  });
});

// ── note (journal document, boolean archived) ─────────────────────────────────

describe("rowToNote", () => {
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
    expect(result.authorEntityType).toBe("member");
    expect(result.authorEntityId).toBe("mem-1");
    expect(result.title).toBe("Shopping list");
    expect(result.content).toBe("Eggs, milk, bread");
    expect(result.backgroundColor).toBe("#ffffcc");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
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
    expect(result.authorEntityType).toBeNull();
    expect(result.authorEntityId).toBeNull();
  });
});

// ── structure-entity (system-core, boolean archived) ──────────────────────────

describe("rowToStructureEntity", () => {
  it("maps structure entity row", () => {
    const row: Record<string, unknown> = {
      id: "se-1",
      system_id: "sys-1",
      entity_type_id: "set-1",
      name: "Root",
      description: null,
      color: null,
      image_source: null,
      emoji: null,
      sort_order: 0.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToStructureEntity(row);

    expect(result.id).toBe("se-1");
    expect(result.entityTypeId).toBe("set-1");
    expect(result.name).toBe("Root");
    expect(result.description).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── structure-entity-type (system-core, boolean archived) ─────────────────────

describe("rowToStructureEntityType", () => {
  it("maps structure entity type row", () => {
    const row: Record<string, unknown> = {
      id: "set-1",
      system_id: "sys-1",
      name: "Body",
      description: "Physical form",
      color: "#00ff00",
      image_source: null,
      emoji: "🧬",
      sort_order: 1.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToStructureEntityType(row);

    expect(result.id).toBe("set-1");
    expect(result.name).toBe("Body");
    expect(result.emoji).toBe("🧬");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── timer (system-core, multiple booleans) ────────────────────────────────────

describe("rowToTimer", () => {
  it("maps timer row with waking_hours_only and enabled booleans", () => {
    const row: Record<string, unknown> = {
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
    };

    const result = rowToTimer(row);

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
});

// ── lifecycle-event (append-only, no archived handling) ───────────────────────

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
  });
});

// ── check-in-record (fronting document, dismissed + archived booleans) ────────

describe("rowToCheckInRecord", () => {
  it("maps check-in record row", () => {
    const row: Record<string, unknown> = {
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
    };

    const result = rowToCheckInRecord(row);

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
});

// ── fronting-comment (fronting document, boolean archived) ────────────────────

describe("rowToFrontingComment", () => {
  it("maps fronting comment row", () => {
    const row: Record<string, unknown> = {
      id: "fco-1",
      fronting_session_id: "fs-1",
      system_id: "sys-1",
      member_id: "mem-1",
      custom_front_id: null,
      structure_entity_id: null,
      content: "Felt anxious",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFrontingComment(row);

    expect(result.id).toBe("fco-1");
    expect(result.frontingSessionId).toBe("fs-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.content).toBe("Felt anxious");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── field-definition (system-core, required + archived booleans) ──────────────

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

// ── field-value (system-core) ─────────────────────────────────────────────────

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

    const result = rowToFieldValue(row, "sys-1" as import("@pluralscape/types").SystemId);

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
});

// ── innerworld-entity (system-core, boolean archived) ────────────────────────

describe("rowToInnerWorldEntity", () => {
  it("maps innerworld member entity row with JSON visual", () => {
    const row: Record<string, unknown> = {
      id: "iwe-1",
      system_id: "sys-1",
      entity_type: "member",
      position_x: 100.5,
      position_y: 200.0,
      visual:
        '{"color":"#ff0000","icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      region_id: "iwr-1",
      linked_member_id: "mem-1",
      linked_structure_entity_id: null,
      name: null,
      description: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldEntity(row);

    expect(result.id).toBe("iwe-1");
    expect(result.entityType).toBe("member");
    expect(result.positionX).toBe(100.5);
    expect(result.positionY).toBe(200.0);
    expect(result.regionId).toBe("iwr-1");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
    if (result.entityType === "member") {
      expect(result.linkedMemberId).toBe("mem-1");
    }
  });
});

// ── innerworld-region (system-core, boolean archived) ────────────────────────

describe("rowToInnerWorldRegion", () => {
  it("maps innerworld region row with JSON fields", () => {
    const row: Record<string, unknown> = {
      id: "iwr-1",
      system_id: "sys-1",
      name: "Forest",
      description: "A peaceful place",
      parent_region_id: null,
      visual:
        '{"color":null,"icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
      boundary_data: '[{"x":0,"y":0},{"x":100,"y":0}]',
      access_type: "open",
      gatekeeper_member_ids: "[]",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldRegion(row);

    expect(result.id).toBe("iwr-1");
    expect(result.name).toBe("Forest");
    expect(result.parentRegionId).toBeNull();
    expect(result.boundaryData).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.accessType).toBe("open");
    expect(result.gatekeeperMemberIds).toEqual([]);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

// ── friend-code (privacy-config, no version) ─────────────────────────────────

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

// ── fronting-report (fronting document, locally encrypted) ───────────────────

describe("rowToFrontingReport", () => {
  it("maps fronting report row", () => {
    const row: Record<string, unknown> = {
      id: "fr-1",
      system_id: "sys-1",
      encrypted_data: "base64encodedblob",
      format: "json",
      generated_at: 1_700_000_000_000,
    };

    const result = rowToFrontingReport(row);

    expect(result.id).toBe("fr-1");
    expect(result.systemId).toBe("sys-1");
  });
});

// ── wiki-page (journal document, boolean archived) ────────────────────────────

describe("rowToWikiPage", () => {
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
});

// ── Row transform error handling ──────────────────────────────────────────────

function baseMemberRow(): Record<string, unknown> {
  return {
    id: "mem-edge",
    system_id: "sys-1",
    name: "Edge",
    pronouns: '["they","them"]',
    description: null,
    avatar_source: null,
    colors: "[]",
    saturation_level: '{"kind":"known","level":"fragment"}',
    tags: "[]",
    suppress_friend_front_notification: 0,
    board_message_notification_on_front: 0,
    archived: 0,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
  };
}

function baseSystemSettingsRow(): Record<string, unknown> {
  return {
    id: "ss-edge",
    system_id: "sys-1",
    theme: "dark",
    font_scale: 1,
    locale: null,
    default_bucket_id: null,
    app_lock: '{"enabled":false}',
    notifications: "{}",
    sync_preferences: "{}",
    privacy_defaults: "{}",
    littles_safe_mode: '{"enabled":false}',
    nomenclature: "{}",
    saturation_levels_enabled: 0,
    auto_capture_fronting_on_journal: 0,
    snapshot_schedule: "{}",
    onboarding_complete: 0,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
  };
}

describe("row transform error handling", () => {
  describe("malformed JSON", () => {
    it("throws RowTransformError for invalid JSON in member pronouns", () => {
      const row = { ...baseMemberRow(), pronouns: "{not-valid-json" };
      expect(() => rowToMember(row)).toThrow(RowTransformError);
      expect(() => rowToMember(row)).toThrow(/members\.pronouns/);
    });

    it("throws RowTransformError for invalid JSON in system settings appLock", () => {
      const row = { ...baseSystemSettingsRow(), app_lock: "{broken" };
      expect(() => rowToSystemSettings(row)).toThrow(RowTransformError);
      expect(() => rowToSystemSettings(row)).toThrow(/system_settings\.app_lock/);
    });
  });

  describe("wrong column types", () => {
    it("throws RowTransformError when string column receives a number", () => {
      const row = { ...baseMemberRow(), id: 123 };
      expect(() => rowToMember(row)).toThrow(RowTransformError);
      expect(() => rowToMember(row)).toThrow(/members\.id.*expected string/i);
    });

    it("throws RowTransformError when timestamp column receives a string", () => {
      const row = { ...baseMemberRow(), created_at: "not-a-timestamp" };
      expect(() => rowToMember(row)).toThrow(RowTransformError);
      expect(() => rowToMember(row)).toThrow(/members\.created_at.*expected number/i);
    });
  });

  describe("privacy fail-closed", () => {
    it("defaults suppressFriendFrontNotification to true when column is null", () => {
      const row = { ...baseMemberRow(), suppress_friend_front_notification: null };
      const result = rowToMember(row);
      expect(result.suppressFriendFrontNotification).toBe(true);
    });

    it("defaults boardMessageNotificationOnFront to true when column is undefined", () => {
      const row = baseMemberRow();
      delete row["board_message_notification_on_front"];
      const result = rowToMember(row);
      expect(result.boardMessageNotificationOnFront).toBe(true);
    });
  });

  describe("archived handling", () => {
    it("returns archived member with archivedAt equal to updatedAt", () => {
      const row = { ...baseMemberRow(), archived: 1, updated_at: 1_700_000_005_000 };
      const result = rowToMember(row);
      expect(result.archived).toBe(true);
      if (result.archived) {
        expect(result.archivedAt).toBe(1_700_000_005_000);
      }
    });

    it("returns non-archived member with version 0", () => {
      const row = baseMemberRow();
      const result = rowToMember(row);
      expect(result.archived).toBe(false);
      expect(result.version).toBe(0);
    });
  });
});
