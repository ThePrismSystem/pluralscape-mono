import { describe, expect, it } from "vitest";

import {
  rowToAcknowledgementRow,
  rowToBoardMessageRow,
  rowToChannelRow,
  rowToCheckInRecordRow,
  rowToCustomFrontRow,
  rowToFieldDefinitionRow,
  rowToFieldValueRow,
  rowToFriendCodeRow,
  rowToFriendConnectionRow,
  rowToFrontingCommentRow,
  rowToFrontingReportRow,
  rowToFrontingSessionRow,
  rowToGroupRow,
  rowToInnerWorldEntityRow,
  rowToInnerWorldRegionRow,
  rowToJournalEntryRow,
  rowToLifecycleEventRow,
  rowToMemberRow,
  rowToMessageRow,
  rowToNoteRow,
  rowToPollRow,
  rowToPrivacyBucketRow,
  rowToRelationshipRow,
  rowToStructureEntityRow,
  rowToStructureEntityTypeRow,
  rowToTimerRow,
  rowToWikiPageRow,
} from "../row-transforms.js";

// ── Helper: toMs ──────────────────────────────────────────────────────────────
// UnixMillis is a branded type, but for test assertions plain numeric equality works.

// ── member (system-core, encrypted in API, plaintext in SQLite) ───────────────

describe("rowToMemberRow", () => {
  it("maps snake_case SQLite columns to camelCase and converts boolean integers", () => {
    const row: Record<string, unknown> = {
      id: "mem-1",
      system_id: "sys-1",
      name: "Alice",
      pronouns: '["she","her"]',
      description: "A member",
      avatar_source: null,
      colors: '["#ff0000"]',
      saturation_level: "high",
      tags: "[]",
      suppress_friend_front_notification: 0,
      board_message_notification_on_front: 1,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToMemberRow(row);

    expect(result.id).toBe("mem-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("Alice");
    expect(result.pronouns).toEqual(["she", "her"]);
    expect(result.description).toBe("A member");
    expect(result.avatarSource).toBeNull();
    expect(result.colors).toEqual(["#ff0000"]);
    expect(result.saturationLevel).toBe("high");
    expect(result.tags).toEqual([]);
    expect(result.suppressFriendFrontNotification).toBe(false);
    expect(result.boardMessageNotificationOnFront).toBe(true);
    expect(result.archived).toBe(false);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_001_000);
  });

  it("sets archived to true when integer is 1", () => {
    const row: Record<string, unknown> = {
      id: "mem-2",
      system_id: "sys-1",
      name: "Bob",
      pronouns: '["they","them"]',
      description: null,
      avatar_source: null,
      colors: "[]",
      saturation_level: "medium",
      tags: "[]",
      suppress_friend_front_notification: 0,
      board_message_notification_on_front: 0,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToMemberRow(row);
    expect(result.archived).toBe(true);
  });
});

// ── fronting-session (fronting, encrypted in API, plaintext in SQLite) ────────

describe("rowToFrontingSessionRow", () => {
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

    const result = rowToFrontingSessionRow(row);

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

    const result = rowToFrontingSessionRow(row);
    expect(result.endTime).toBeNull();
  });
});

// ── message (chat, encrypted in API, plaintext in SQLite) ─────────────────────

describe("rowToMessageRow", () => {
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
      edit_of: null,
      archived: 0,
    };

    const result = rowToMessageRow(row);

    expect(result.id).toBe("msg-1");
    expect(result.channelId).toBe("chan-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Hello world");
    expect(result.attachments).toEqual(["blob-1"]);
    expect(result.mentions).toEqual(["mem-2"]);
    expect(result.replyToId).toBeNull();
    expect(result.timestamp).toBe(1_700_000_000_000);
    expect(result.editOf).toBeNull();
    expect(result.archived).toBe(false);
  });
});

// ── journal-entry (journal document) ──────────────────────────────────────────

describe("rowToJournalEntryRow", () => {
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

    const result = rowToJournalEntryRow(row);

    expect(result.id).toBe("je-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.author).toBe("mem-1");
    expect(result.frontingSessionId).toBeNull();
    expect(result.title).toBe("First entry");
    expect(result.blocks).toEqual([{ type: "paragraph", text: "Hello" }]);
    expect(result.tags).toEqual(["mood", "daily"]);
    expect(result.linkedEntities).toEqual([]);
    expect(result.frontingSnapshots).toBeNull();
    expect(result.archived).toBe(false);
  });
});

// ── privacy-bucket / bucket (privacy-config, boolean archived) ────────────────

describe("rowToPrivacyBucketRow", () => {
  it("maps bucket row to PrivacyBucketRaw shape", () => {
    const row: Record<string, unknown> = {
      id: "bkt-1",
      system_id: "sys-1",
      name: "Friends Only",
      description: "Visible to close friends",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToPrivacyBucketRow(row);

    expect(result.id).toBe("bkt-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("Friends Only");
    expect(result.description).toBe("Visible to close friends");
    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_000_000);
  });

  it("sets archived to true for archived buckets", () => {
    const row: Record<string, unknown> = {
      id: "bkt-2",
      system_id: "sys-1",
      name: "Old bucket",
      description: null,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToPrivacyBucketRow(row);
    expect(result.archived).toBe(true);
    expect(result.archivedAt).toBeNull();
  });
});

// ── friend-connection (privacy-config, no encryption) ────────────────────────

describe("rowToFriendConnectionRow", () => {
  it("maps friend connection row with JSON-serialized arrays", () => {
    const row: Record<string, unknown> = {
      id: "fc-1",
      account_id: "acct-1",
      friend_account_id: "acct-2",
      status: "accepted",
      assigned_buckets: '["bkt-1","bkt-2"]',
      visibility: '"all"',
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFriendConnectionRow(row);

    expect(result.id).toBe("fc-1");
    expect(result.accountId).toBe("acct-1");
    expect(result.friendAccountId).toBe("acct-2");
    expect(result.status).toBe("accepted");
    expect(result.assignedBuckets).toEqual(["bkt-1", "bkt-2"]);
    expect(result.visibility).toBe("all");
    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
  });
});

// ── group (system-core, encrypted in API, boolean archived) ──────────────────

describe("rowToGroupRow", () => {
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

    const result = rowToGroupRow(row);

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
  });
});

// ── channel (chat, boolean archived) ─────────────────────────────────────────

describe("rowToChannelRow", () => {
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

    const result = rowToChannelRow(row);

    expect(result.id).toBe("chan-1");
    expect(result.name).toBe("General");
    expect(result.type).toBe("text");
    expect(result.parentId).toBeNull();
    expect(result.sortOrder).toBe(0.5);
    expect(result.archived).toBe(false);
  });
});

// ── custom-front (system-core, boolean archived) ──────────────────────────────

describe("rowToCustomFrontRow", () => {
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

    const result = rowToCustomFrontRow(row);

    expect(result.id).toBe("cf-1");
    expect(result.name).toBe("Dissociated");
    expect(result.description).toBe("Floaty headspace");
    expect(result.color).toBe("#aabbcc");
    expect(result.emoji).toBe("🌫️");
    expect(result.archived).toBe(false);
  });
});

// ── board-message (chat, boolean archived, pinned) ────────────────────────────

describe("rowToBoardMessageRow", () => {
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

    const result = rowToBoardMessageRow(row);

    expect(result.id).toBe("bm-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Welcome!");
    expect(result.pinned).toBe(true);
    expect(result.sortOrder).toBe(1.0);
    expect(result.archived).toBe(false);
  });
});

// ── poll (chat, multiple boolean columns) ─────────────────────────────────────

describe("rowToPollRow", () => {
  it("maps poll row with multiple boolean fields", () => {
    const row: Record<string, unknown> = {
      id: "poll-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      title: "Which day?",
      description: null,
      kind: "decision",
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

    const result = rowToPollRow(row);

    expect(result.id).toBe("poll-1");
    expect(result.title).toBe("Which day?");
    expect(result.kind).toBe("decision");
    expect(result.status).toBe("open");
    expect(result.allowMultipleVotes).toBe(false);
    expect(result.maxVotesPerMember).toBe(1);
    expect(result.allowAbstain).toBe(true);
    expect(result.allowVeto).toBe(false);
    expect(result.archived).toBe(false);
  });
});

// ── acknowledgement (chat, confirmed boolean) ─────────────────────────────────

describe("rowToAcknowledgementRow", () => {
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

    const result = rowToAcknowledgementRow(row);

    expect(result.id).toBe("ack-1");
    expect(result.createdByMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.message).toBe("Are you okay?");
    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
    expect(result.archived).toBe(false);
  });
});

// ── relationship (system-core, boolean bidirectional) ─────────────────────────

describe("rowToRelationshipRow", () => {
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

    const result = rowToRelationshipRow(row);

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

describe("rowToNoteRow", () => {
  it("maps note row with author entity fields", () => {
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

    const result = rowToNoteRow(row);

    expect(result.id).toBe("note-1");
    expect(result.authorEntityType).toBe("member");
    expect(result.authorEntityId).toBe("mem-1");
    expect(result.title).toBe("Shopping list");
    expect(result.content).toBe("Eggs, milk, bread");
    expect(result.backgroundColor).toBe("#ffffcc");
    expect(result.archived).toBe(false);
  });
});

// ── structure-entity (system-core, boolean archived) ──────────────────────────

describe("rowToStructureEntityRow", () => {
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

    const result = rowToStructureEntityRow(row);

    expect(result.id).toBe("se-1");
    expect(result.entityTypeId).toBe("set-1");
    expect(result.name).toBe("Root");
    expect(result.description).toBeNull();
    expect(result.archived).toBe(false);
  });
});

// ── structure-entity-type (system-core, boolean archived) ─────────────────────

describe("rowToStructureEntityTypeRow", () => {
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

    const result = rowToStructureEntityTypeRow(row);

    expect(result.id).toBe("set-1");
    expect(result.name).toBe("Body");
    expect(result.emoji).toBe("🧬");
    expect(result.archived).toBe(false);
  });
});

// ── timer (system-core, multiple booleans) ────────────────────────────────────

describe("rowToTimerRow", () => {
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

    const result = rowToTimerRow(row);

    expect(result.id).toBe("tmr-1");
    expect(result.intervalMinutes).toBe(60);
    expect(result.wakingHoursOnly).toBe(true);
    expect(result.wakingStart).toBe("08:00");
    expect(result.wakingEnd).toBe("22:00");
    expect(result.promptText).toBe("How are you feeling?");
    expect(result.enabled).toBe(true);
    expect(result.archived).toBe(false);
  });
});

// ── lifecycle-event (system-core, boolean archived) ───────────────────────────

describe("rowToLifecycleEventRow", () => {
  it("maps lifecycle event row with JSON payload", () => {
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

    const result = rowToLifecycleEventRow(row);

    expect(result.id).toBe("le-1");
    expect(result.eventType).toBe("discovery");
    expect(result.occurredAt).toBe(1_700_000_000_000);
    expect(result.recordedAt).toBe(1_700_000_001_000);
    expect(result.notes).toBe("Found a new member");
    expect(result.payload).toEqual({ memberId: "mem-1" });
    expect(result.archived).toBe(false);
  });
});

// ── check-in-record (fronting document, dismissed + archived booleans) ────────

describe("rowToCheckInRecordRow", () => {
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
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToCheckInRecordRow(row);

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

describe("rowToFrontingCommentRow", () => {
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

    const result = rowToFrontingCommentRow(row);

    expect(result.id).toBe("fco-1");
    expect(result.frontingSessionId).toBe("fs-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.content).toBe("Felt anxious");
    expect(result.archived).toBe(false);
  });
});

// ── field-definition (system-core, required + archived booleans) ──────────────

describe("rowToFieldDefinitionRow", () => {
  it("maps field definition row with options JSON and scopes JSON", () => {
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

    const result = rowToFieldDefinitionRow(row);

    expect(result.id).toBe("fd-1");
    expect(result.name).toBe("Age Range");
    expect(result.fieldType).toBe("select");
    expect(result.options).toEqual(["0-10", "11-17", "18+"]);
    expect(result.required).toBe(false);
    expect(result.sortOrder).toBe(2.0);
    expect(result.scopes).toEqual(["member"]);
    expect(result.archived).toBe(false);
  });
});

// ── field-value (system-core) ─────────────────────────────────────────────────

describe("rowToFieldValueRow", () => {
  it("maps field value row with JSON-serialized value", () => {
    const row: Record<string, unknown> = {
      id: "fv-1",
      field_definition_id: "fd-1",
      member_id: "mem-1",
      structure_entity_id: null,
      group_id: null,
      value: '"18+"',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFieldValueRow(row);

    expect(result.id).toBe("fv-1");
    expect(result.fieldDefinitionId).toBe("fd-1");
    expect(result.memberId).toBe("mem-1");
    expect(result.structureEntityId).toBeNull();
    expect(result.groupId).toBeNull();
    expect(result.value).toBe("18+");
    expect(result.createdAt).toBe(1_700_000_000_000);
  });
});

// ── innerworld-entity (system-core, boolean archived) ────────────────────────

describe("rowToInnerWorldEntityRow", () => {
  it("maps innerworld entity row with JSON visual", () => {
    const row: Record<string, unknown> = {
      id: "iwe-1",
      system_id: "sys-1",
      entity_type: "member",
      position_x: 100.5,
      position_y: 200.0,
      visual: '{"shape":"circle","color":"#ff0000"}',
      region_id: "iwr-1",
      linked_member_id: "mem-1",
      linked_structure_entity_id: null,
      name: null,
      description: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldEntityRow(row);

    expect(result.id).toBe("iwe-1");
    expect(result.entityType).toBe("member");
    expect(result.positionX).toBe(100.5);
    expect(result.positionY).toBe(200.0);
    expect(result.visual).toEqual({ shape: "circle", color: "#ff0000" });
    expect(result.regionId).toBe("iwr-1");
    expect(result.linkedMemberId).toBe("mem-1");
    expect(result.archived).toBe(false);
  });
});

// ── innerworld-region (system-core, boolean archived) ────────────────────────

describe("rowToInnerWorldRegionRow", () => {
  it("maps innerworld region row with JSON fields", () => {
    const row: Record<string, unknown> = {
      id: "iwr-1",
      system_id: "sys-1",
      name: "Forest",
      description: "A peaceful place",
      parent_region_id: null,
      visual: '{"background":"green"}',
      boundary_data: '[{"x":0,"y":0},{"x":100,"y":0}]',
      access_type: "open",
      gatekeeper_member_ids: "[]",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToInnerWorldRegionRow(row);

    expect(result.id).toBe("iwr-1");
    expect(result.name).toBe("Forest");
    expect(result.parentRegionId).toBeNull();
    expect(result.visual).toEqual({ background: "green" });
    expect(result.boundaryData).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.accessType).toBe("open");
    expect(result.gatekeeperMemberIds).toEqual([]);
    expect(result.archived).toBe(false);
  });
});

// ── friend-code (privacy-config, no version) ─────────────────────────────────

describe("rowToFriendCodeRow", () => {
  it("maps friend code row", () => {
    const row: Record<string, unknown> = {
      id: "frc-1",
      account_id: "acct-1",
      code: "ALPHA123",
      created_at: 1_700_000_000_000,
      expires_at: 1_700_086_400_000,
      archived: 0,
    };

    const result = rowToFriendCodeRow(row);

    expect(result.id).toBe("frc-1");
    expect(result.accountId).toBe("acct-1");
    expect(result.code).toBe("ALPHA123");
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.expiresAt).toBe(1_700_086_400_000);
    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
  });
});

// ── fronting-report (fronting document) ───────────────────────────────────────

describe("rowToFrontingReportRow", () => {
  it("maps fronting report row", () => {
    const row: Record<string, unknown> = {
      id: "fr-1",
      system_id: "sys-1",
      encrypted_data: "base64encodedblob",
      format: "json",
      generated_at: 1_700_000_000_000,
    };

    const result = rowToFrontingReportRow(row);

    expect(result.id).toBe("fr-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.encryptedData).toBe("base64encodedblob");
    expect(result.format).toBe("json");
    expect(result.generatedAt).toBe(1_700_000_000_000);
  });
});

// ── wiki-page (journal document, boolean archived) ────────────────────────────

describe("rowToWikiPageRow", () => {
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

    const result = rowToWikiPageRow(row);

    expect(result.id).toBe("wp-1");
    expect(result.title).toBe("System Overview");
    expect(result.slug).toBe("system-overview");
    expect(result.blocks).toEqual([{ type: "heading", text: "Hello" }]);
    expect(result.linkedFromPages).toEqual(["wp-2"]);
    expect(result.tags).toEqual(["overview"]);
    expect(result.linkedEntities).toEqual([]);
    expect(result.archived).toBe(false);
  });
});
