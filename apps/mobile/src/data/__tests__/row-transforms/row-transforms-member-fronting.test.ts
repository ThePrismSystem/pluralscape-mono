/**
 * Row transform tests for member, fronting session, fronting comment, custom front,
 * and group entities.
 *
 * Covers: rowToMember, rowToFrontingSession, rowToFrontingComment, rowToCustomFront, rowToGroup
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-comms.test.ts,
 *                  row-transforms-structure-innerworld.test.ts,
 *                  row-transforms-misc.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  RowTransformError,
  rowToCustomFront,
  rowToFrontingComment,
  rowToFrontingSession,
  rowToGroup,
  rowToMember,
  rowToSystemSettings,
} from "../../row-transforms/index.js";

// ── rowToMember ───────────────────────────────────────────────────────────────

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

// ── rowToFrontingSession ──────────────────────────────────────────────────────

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

// ── rowToCustomFront ──────────────────────────────────────────────────────────

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

// ── rowToGroup ────────────────────────────────────────────────────────────────

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

// ── rowToFrontingComment ──────────────────────────────────────────────────────

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

// ── row transform error handling ──────────────────────────────────────────────

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
