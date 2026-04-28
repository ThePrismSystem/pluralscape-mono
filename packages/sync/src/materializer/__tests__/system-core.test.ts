import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../../event-bus/index.js";
import { getMaterializer } from "../index.js";

import type { DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb, EntityRow } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

// ── Test helpers ────────────────────────────────────────────────────

interface FakeDb extends MaterializerDb {
  calls: { sql: string; params: unknown[] }[];
  tables: Map<string, EntityRow[]>;
}

function makeDb(tables?: Map<string, EntityRow[]>): FakeDb {
  const t = tables ?? new Map<string, EntityRow[]>();
  const db: FakeDb = {
    calls: [],
    tables: t,
    queryAll<T>(sql: string): T[] {
      // Parse table name from "SELECT * FROM <tableName>"
      const match = /FROM\s+(\w+)/.exec(sql);
      const tableName = match?.[1] ?? "";
      return (t.get(tableName) ?? []) as T[];
    },
    execute(sql, params) {
      db.calls.push({ sql, params });
    },
    transaction(fn) {
      return fn();
    },
  };
  return db;
}

function makeEventBus() {
  const eventBus = createEventBus<DataLayerEventMap>();
  const emitSpy = vi.fn(eventBus.emit.bind(eventBus));
  return {
    eventBus: { ...eventBus, emit: emitSpy },
    emitSpy,
  };
}

function getSystemCoreMaterializer(): DocumentMaterializer {
  const m = getMaterializer("system-core");
  if (!m) throw new Error("system-core materializer not registered");
  return m;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("systemCoreMaterializer", () => {
  it("has documentType 'system-core'", () => {
    expect(getSystemCoreMaterializer().documentType).toBe("system-core");
  });

  it("materializes members from an Automerge doc", () => {
    const db = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

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

    getSystemCoreMaterializer().materialize(doc, db, eventBus);

    // Should have emitted materialized:document
    expect(emitSpy).toHaveBeenCalledWith("materialized:document", {
      type: "materialized:document",
      documentType: "system-core",
    });

    // Should have emitted search:index-updated
    expect(emitSpy).toHaveBeenCalledWith("search:index-updated", {
      type: "search:index-updated",
      scope: "self",
      documentType: "system-core",
    });

    // Should have executed INSERT OR REPLACE for the member
    const memberInserts = db.calls.filter((c) => c.sql.includes("members"));
    expect(memberInserts.length).toBeGreaterThan(0);
    expect(memberInserts[0]?.sql).toContain("INSERT OR REPLACE INTO");
  });

  it("materializes groups from an Automerge doc", () => {
    const db = makeDb();
    const { eventBus } = makeEventBus();

    const doc: Record<string, unknown> = {
      groups: {
        grp_1: {
          systemId: "sys_1",
          name: "Protectors",
          description: "The protector group",
          parentGroupId: null,
          imageSource: null,
          color: "#00ff00",
          emoji: null,
          sortOrder: 1,
          archived: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
      },
    };

    getSystemCoreMaterializer().materialize(doc, db, eventBus);

    const groupInserts = db.calls.filter((c) => c.sql.includes("groups"));
    expect(groupInserts.length).toBeGreaterThan(0);
    expect(groupInserts[0]?.sql).toContain("INSERT OR REPLACE INTO");
  });

  it("emits materialized:document event", () => {
    const db = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    getSystemCoreMaterializer().materialize({}, db, eventBus);

    expect(emitSpy).toHaveBeenCalledWith("materialized:document", {
      type: "materialized:document",
      documentType: "system-core",
    });
  });

  it("handles empty doc gracefully", () => {
    const db = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    // Should not throw with an empty doc
    expect(() => {
      getSystemCoreMaterializer().materialize({}, db, eventBus);
    }).not.toThrow();

    // Should still emit document-level events
    expect(emitSpy).toHaveBeenCalledWith("materialized:document", {
      type: "materialized:document",
      documentType: "system-core",
    });

    // No entity writes should have happened
    expect(db.calls).toHaveLength(0);
  });

  it("diffs against current SQLite state and only writes changes", () => {
    const existingMembers: EntityRow[] = [
      {
        id: "mem_1",
        system_id: "sys_1",
        name: "Alice",
        pronouns: "she/her",
        description: null,
        avatar_source: null,
        colors: JSON.stringify(["#ff0000"]),
        saturation_level: "full",
        tags: JSON.stringify([]),
        suppress_friend_front_notification: false,
        board_message_notification_on_front: true,
        archived: false,
        created_at: 1000,
        updated_at: 2000,
      },
    ];

    const tables = new Map<string, EntityRow[]>();
    tables.set("members", existingMembers);
    const db = makeDb(tables);
    const { eventBus } = makeEventBus();

    // Same member with same data — should produce no writes for members
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

    getSystemCoreMaterializer().materialize(doc, db, eventBus);

    const memberWrites = db.calls.filter((c) => c.sql.includes("members"));
    expect(memberWrites).toHaveLength(0);
  });

  it("materializes singleton entities (system)", () => {
    const db = makeDb();
    const { eventBus } = makeEventBus();

    const doc: Record<string, unknown> = {
      system: {
        id: "sys_1",
        name: "Our System",
        displayName: "Our System Display",
        description: "A test system",
        avatarSource: null,
        settingsId: "settings_1",
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    getSystemCoreMaterializer().materialize(doc, db, eventBus);

    const systemInserts = db.calls.filter((c) => c.sql.includes("INSERT OR REPLACE INTO systems "));
    expect(systemInserts.length).toBeGreaterThan(0);
  });

  it("materializes junction entities (group-membership)", () => {
    const db = makeDb();
    const { eventBus } = makeEventBus();

    const doc: Record<string, unknown> = {
      groupMemberships: {
        "grp_1:mem_1": true,
        "grp_1:mem_2": true,
      },
    };

    getSystemCoreMaterializer().materialize(doc, db, eventBus);

    const junctionInserts = db.calls.filter((c) => c.sql.includes("group_memberships"));
    expect(junctionInserts.length).toBeGreaterThan(0);
  });
});
