import { describe, expect, it } from "vitest";

import { extractEntities } from "../materializers/extract-entities.js";

// ── lww-map: "member" (fieldName: "members") ─────────────────────────

describe("extractEntities — lww-map (member)", () => {
  it("extracts entities from a Record<id, entity> map", () => {
    const doc: Record<string, unknown> = {
      members: {
        mem_1: {
          systemId: "sys_1",
          name: "Alice",
          pronouns: "she/her",
          description: null,
          avatarSource: null,
          colors: ["#ff0000"],
          saturationLevel: "full",
          tags: [],
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: true,
          archived: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
      },
    };

    const rows = extractEntities("member", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("mem_1");
    expect(rows[0]?.name).toBe("Alice");
    expect(rows[0]?.system_id).toBe("sys_1");
  });

  it("returns empty array when field is missing", () => {
    const rows = extractEntities("member", {});
    expect(rows).toHaveLength(0);
  });

  it("returns empty array when field is null", () => {
    const rows = extractEntities("member", { members: null });
    expect(rows).toHaveLength(0);
  });

  it("skips non-object entries in the map", () => {
    const doc: Record<string, unknown> = {
      members: {
        mem_1: {
          systemId: "sys_1",
          name: "Alice",
          pronouns: "she/her",
          colors: "[]",
          saturationLevel: "full",
          tags: "[]",
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
          archived: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
        mem_bad: "not-an-object",
        mem_null: null,
      },
    };

    const rows = extractEntities("member", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("mem_1");
  });

  it("handles multiple entities", () => {
    const doc: Record<string, unknown> = {
      members: {
        mem_1: {
          systemId: "sys_1",
          name: "Alice",
          pronouns: "she/her",
          colors: "[]",
          saturationLevel: "full",
          tags: "[]",
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
          archived: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
        mem_2: {
          systemId: "sys_1",
          name: "Bob",
          pronouns: "he/him",
          colors: "[]",
          saturationLevel: "full",
          tags: "[]",
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
          archived: false,
          createdAt: 1001,
          updatedAt: 2001,
        },
      },
    };

    const rows = extractEntities("member", doc);
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual(["mem_1", "mem_2"]);
  });
});

// ── singleton-lww: "system" (fieldName: "system") ────────────────────

describe("extractEntities — singleton-lww (system)", () => {
  it("extracts a single entity using the id field", () => {
    const doc: Record<string, unknown> = {
      system: {
        id: "sys_1",
        name: "Our System",
        displayName: "Our System Display",
        description: "A plural system",
        avatarSource: null,
        settingsId: "settings_1",
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    const rows = extractEntities("system", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("sys_1");
    expect(rows[0]?.name).toBe("Our System");
  });

  it("uses entityType as synthetic id when id field is missing", () => {
    const doc: Record<string, unknown> = {
      system: {
        name: "Our System",
        settingsId: "settings_1",
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    const rows = extractEntities("system", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("system");
  });

  it("returns empty array when field is null", () => {
    const rows = extractEntities("system", { system: null });
    expect(rows).toHaveLength(0);
  });

  it("returns empty array when field is missing", () => {
    const rows = extractEntities("system", {});
    expect(rows).toHaveLength(0);
  });

  it("works for system-settings singleton (fieldName: systemSettings)", () => {
    const doc: Record<string, unknown> = {
      systemSettings: {
        id: "settings_1",
        systemId: "sys_1",
        theme: "dark",
        fontScale: 1.0,
        locale: null,
        defaultBucketId: null,
        appLock: "{}",
        notifications: "{}",
        syncPreferences: "{}",
        privacyDefaults: "{}",
        littlesSafeMode: "{}",
        nomenclature: "{}",
        saturationLevelsEnabled: false,
        autoCaptureContingOnJournal: false,
        snapshotSchedule: "{}",
        onboardingComplete: false,
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    const rows = extractEntities("system-settings", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("settings_1");
  });
});

// ── junction-map: "group-membership" (fieldName: "groupMemberships") ─

describe("extractEntities — junction-map (group-membership)", () => {
  it("extracts from compound keys", () => {
    const doc: Record<string, unknown> = {
      groupMemberships: {
        grp_1_mem_1: true,
        grp_1_mem_2: true,
      },
    };

    const rows = extractEntities("group-membership", doc);
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual(["grp_1_mem_1", "grp_1_mem_2"]);
  });

  it("skips keys with fewer than 2 parts", () => {
    const doc: Record<string, unknown> = {
      groupMemberships: {
        grp1mem1: true, // no underscore separator producing 2+ parts
        grp_1_mem_1: true,
      },
    };

    const rows = extractEntities("group-membership", doc);
    // grp1mem1 has only 1 part (no underscore), grp_1_mem_1 has 4 parts
    // The key "grp1mem1" has 0 underscores so it produces 1 part => skip
    const skippedIds = rows.map((r) => r.id);
    expect(skippedIds).not.toContain("grp1mem1");
    expect(skippedIds).toContain("grp_1_mem_1");
  });

  it("returns empty array when field is null", () => {
    const rows = extractEntities("group-membership", { groupMemberships: null });
    expect(rows).toHaveLength(0);
  });

  it("returns empty array when field is missing", () => {
    const rows = extractEntities("group-membership", {});
    expect(rows).toHaveLength(0);
  });

  it("populates group_id and member_id columns from compound key parts", () => {
    const doc: Record<string, unknown> = {
      groupMemberships: {
        grp_abc_mem_xyz: true,
      },
    };

    const rows = extractEntities("group-membership", doc);
    expect(rows).toHaveLength(1);
    // The compound key "grp_abc_mem_xyz" splits into ["grp", "abc", "mem", "xyz"]
    // The non-id columns are group_id and member_id
    expect(rows[0]?.id).toBe("grp_abc_mem_xyz");
    expect(rows[0]?.group_id).toBe("grp");
    expect(rows[0]?.member_id).toBe("abc");
  });
});

// ── append-only: "message" uses append-only (fieldName: "messages") ──
// Note: lifecycle-event is actually append-lww (which delegates to extractMapEntities).
// "message" is the real append-only type with both array and map forms.

describe("extractEntities — append-only (message)", () => {
  it("extracts from Record map form", () => {
    const doc: Record<string, unknown> = {
      messages: {
        msg_1: {
          channelId: "ch_1",
          systemId: "sys_1",
          senderId: "mem_1",
          content: "Hello!",
          attachments: [],
          mentions: [],
          replyToId: null,
          timestamp: 1000,
          editOf: null,
          archived: false,
        },
      },
    };

    const rows = extractEntities("message", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("msg_1");
    expect(rows[0]?.content).toBe("Hello!");
  });

  it("extracts from array form using id field when present", () => {
    const doc: Record<string, unknown> = {
      messages: [
        {
          id: "msg_1",
          channelId: "ch_1",
          systemId: "sys_1",
          senderId: "mem_1",
          content: "Array message",
          attachments: [],
          mentions: [],
          replyToId: null,
          timestamp: 1000,
          editOf: null,
          archived: false,
        },
      ],
    };

    const rows = extractEntities("message", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("msg_1");
    expect(rows[0]?.content).toBe("Array message");
  });

  it("uses index as fallback id when id field is missing in array", () => {
    const doc: Record<string, unknown> = {
      messages: [
        {
          channelId: "ch_1",
          systemId: "sys_1",
          senderId: "mem_1",
          content: "No id here",
          attachments: [],
          mentions: [],
          timestamp: 1000,
          archived: false,
        },
      ],
    };

    const rows = extractEntities("message", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("0");
  });

  it("skips non-objects in array form", () => {
    const doc: Record<string, unknown> = {
      messages: [
        null,
        "not-an-object",
        {
          id: "msg_1",
          channelId: "ch_1",
          systemId: "sys_1",
          senderId: "mem_1",
          content: "Valid",
          attachments: [],
          mentions: [],
          timestamp: 1000,
          archived: false,
        },
      ],
    };

    const rows = extractEntities("message", doc);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("msg_1");
  });

  it("returns empty array when field is missing", () => {
    const rows = extractEntities("message", {});
    expect(rows).toHaveLength(0);
  });

  it("returns empty array when field is null", () => {
    const rows = extractEntities("message", { messages: null });
    expect(rows).toHaveLength(0);
  });
});
