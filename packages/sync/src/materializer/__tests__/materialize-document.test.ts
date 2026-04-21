import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../../event-bus/index.js";
import { materializeDocument } from "../materializers/materialize-document.js";

import type { DataLayerEventMap, EventBus } from "../../event-bus/index.js";
import type { SyncedEntityType } from "../../strategies/crdt-strategies.js";
import type { EntityRow, MaterializerDb } from "../base-materializer.js";

// ── Test helpers ──────────────────────────────────────────────────────

function makeDb(tables?: Map<string, EntityRow[]>) {
  const t = tables ?? new Map<string, EntityRow[]>();
  const calls: { sql: string; params: unknown[] }[] = [];
  const queries: string[] = [];
  const db: MaterializerDb = {
    queryAll<T>(sql: string): T[] {
      queries.push(sql);
      const match = /FROM\s+(\w+)/.exec(sql);
      const tableName = match?.[1] ?? "";
      return (t.get(tableName) ?? []) as T[];
    },
    execute(sql, params) {
      calls.push({ sql, params });
    },
    transaction(fn) {
      return fn();
    },
  };
  return { db, calls, queries };
}

function makeEventBus() {
  const eventBus = createEventBus<DataLayerEventMap>();
  const emitSpy = vi.fn(eventBus.emit.bind(eventBus));
  return {
    eventBus: { ...eventBus, emit: emitSpy } as EventBus<DataLayerEventMap>,
    emitSpy,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("materializeDocument", () => {
  it("emits materialized:document event after processing", () => {
    const { db } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    materializeDocument("system-core", {}, db, eventBus);

    expect(emitSpy).toHaveBeenCalledWith("materialized:document", {
      type: "materialized:document",
      documentType: "system-core",
    });
  });

  it("emits search:index-updated event with correct scope", () => {
    const { db } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    materializeDocument("system-core", {}, db, eventBus);

    expect(emitSpy).toHaveBeenCalledWith("search:index-updated", {
      type: "search:index-updated",
      scope: "self",
      documentType: "system-core",
    });
  });

  it("emits both events even when doc is empty", () => {
    const { db } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    materializeDocument("fronting", {}, db, eventBus);

    const eventTypes = emitSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("materialized:document");
    expect(eventTypes).toContain("search:index-updated");
  });

  it("inserts entities into the database from the document", () => {
    const { db, calls } = makeDb();
    const { eventBus } = makeEventBus();

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

    materializeDocument("system-core", doc, db, eventBus);

    const memberInserts = calls.filter((c) => c.sql.includes("members"));
    expect(memberInserts.length).toBeGreaterThan(0);
    expect(memberInserts[0]?.sql).toContain("INSERT OR REPLACE INTO");
  });

  it("deletes entities that are no longer in the document", () => {
    const existing: EntityRow[] = [
      {
        id: "mem_old",
        system_id: "sys_1",
        name: "OldMember",
        pronouns: "they/them",
        description: null,
        avatar_source: null,
        colors: "[]",
        saturation_level: "full",
        tags: "[]",
        suppress_friend_front_notification: 0,
        board_message_notification_on_front: 0,
        archived: 0,
        created_at: 500,
        updated_at: 600,
      },
    ];

    const tables = new Map<string, EntityRow[]>();
    tables.set("members", existing);
    const { db, calls } = makeDb(tables);
    const { eventBus } = makeEventBus();

    // Doc has a different member — mem_old should be deleted
    const doc: Record<string, unknown> = {
      members: {
        mem_new: {
          systemId: "sys_1",
          name: "NewMember",
          pronouns: "she/her",
          colors: [],
          saturationLevel: "full",
          tags: [],
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
          archived: false,
          createdAt: 1000,
          updatedAt: 2000,
        },
      },
    };

    materializeDocument("system-core", doc, db, eventBus);

    const deletes = calls.filter((c) => c.sql.includes("DELETE FROM members"));
    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes[0]?.params).toContain("mem_old");
  });

  it("does not write to the database when doc is empty (no diff)", () => {
    const { db, calls } = makeDb();
    const { eventBus } = makeEventBus();

    materializeDocument("system-core", {}, db, eventBus);

    // No inserts or deletes should occur
    expect(calls).toHaveLength(0);
  });

  it("skips SELECT queries for entity types not present in the document", () => {
    const { db, queries } = makeDb();
    const { eventBus } = makeEventBus();

    // system-core has multiple entity types (system, system-settings, member, etc.)
    // but we only provide members — other tables should not be queried
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

    materializeDocument("system-core", doc, db, eventBus);

    // Only the members table should be queried
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("members");
  });

  it("issues zero SELECT queries when document has no entity data", () => {
    const { db, queries } = makeDb();
    const { eventBus } = makeEventBus();

    // system-core has many entity types but doc is empty — no queries should fire
    materializeDocument("system-core", {}, db, eventBus);

    expect(queries).toHaveLength(0);
  });

  it("materializes note document type without errors (no entity types map to it)", () => {
    const { db, calls } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    // No entity has document: "note" — result is zero DB writes
    materializeDocument("note", {}, db, eventBus);

    expect(calls).toHaveLength(0);
    const eventTypes = emitSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("materialized:document");
    expect(eventTypes).toContain("search:index-updated");
  });

  it("materializes bucket document type without errors (no entity types map to it)", () => {
    const { db, calls } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    // No entity has document: "bucket" — result is zero DB writes
    materializeDocument("bucket", {}, db, eventBus);

    expect(calls).toHaveLength(0);
    const eventTypes = emitSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("materialized:document");
    expect(eventTypes).toContain("search:index-updated");
  });

  it("materializes chat document type entities", () => {
    const { db, calls } = makeDb();
    const { eventBus } = makeEventBus();

    const doc: Record<string, unknown> = {
      channel: {
        id: "ch_1",
        systemId: "sys_1",
        name: "general",
        type: "text",
        parentId: null,
        sortOrder: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    materializeDocument("chat", doc, db, eventBus);

    const channelInserts = calls.filter((c) => c.sql.includes("channels"));
    expect(channelInserts.length).toBeGreaterThan(0);
  });
});

describe("materializeDocument dirtyEntityTypes", () => {
  it("skips queryAll for entity types not in the dirty set", () => {
    const { db, queries } = makeDb();
    const { eventBus } = makeEventBus();

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
      system: {
        id: "sys_1",
        name: "System",
        description: null,
        avatarSource: null,
        createdAt: 1000,
        updatedAt: 2000,
      },
    };

    // Mark only members dirty — system should not be queried even though
    // it is present in the document.
    const dirty = new Set<SyncedEntityType>(["member"]);
    materializeDocument("system-core", doc, db, eventBus, dirty);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("members");
  });

  it("scans all entity types when dirtyEntityTypes is undefined (default — no dirty filter)", () => {
    const { db, queries } = makeDb();
    const { eventBus } = makeEventBus();

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

    materializeDocument("system-core", doc, db, eventBus);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("members");
  });

  it("issues zero queries when dirty set excludes every present entity type", () => {
    const { db, queries, calls } = makeDb();
    const { eventBus } = makeEventBus();

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

    // Dirty set points at an entity type that is not in the document.
    const dirty = new Set<SyncedEntityType>(["group"]);
    materializeDocument("system-core", doc, db, eventBus, dirty);

    expect(queries).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("still emits materialized:document and search:index-updated events when dirty set is empty", () => {
    const { db } = makeDb();
    const { eventBus, emitSpy } = makeEventBus();

    materializeDocument("system-core", {}, db, eventBus, new Set());

    const eventTypes = emitSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("materialized:document");
    expect(eventTypes).toContain("search:index-updated");
  });
});
