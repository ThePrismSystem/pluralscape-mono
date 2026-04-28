import { describe, expect, it, vi } from "vitest";

import {
  applyDiff,
  diffEntities,
  entityToRow,
  toSnakeCase,
  type EntityRow,
  type MaterializerDb,
} from "../base-materializer.js";

import type { MaterializerTableMetadata } from "../drizzle-bridge.js";

// ── diffEntities ──────────────────────────────────────────────────────

describe("diffEntities", () => {
  it("detects new entities as inserts", () => {
    const current: EntityRow[] = [];
    const incoming: EntityRow[] = [{ id: "a", name: "Alice" }];
    const diff = diffEntities(current, incoming);
    expect(diff.inserts).toHaveLength(1);
    expect(diff.inserts[0]).toEqual({ id: "a", name: "Alice" });
    expect(diff.updates).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("detects removed entities as deletes", () => {
    const current: EntityRow[] = [{ id: "a", name: "Alice" }];
    const incoming: EntityRow[] = [];
    const diff = diffEntities(current, incoming);
    expect(diff.deletes).toHaveLength(1);
    expect(diff.deletes[0]).toBe("a");
    expect(diff.inserts).toHaveLength(0);
    expect(diff.updates).toHaveLength(0);
  });

  it("detects changed entities as updates", () => {
    const current: EntityRow[] = [{ id: "a", name: "Alice" }];
    const incoming: EntityRow[] = [{ id: "a", name: "Alicia" }];
    const diff = diffEntities(current, incoming);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]).toEqual({ id: "a", name: "Alicia" });
    expect(diff.inserts).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("returns empty diff when entities are identical", () => {
    const rows: EntityRow[] = [
      { id: "a", name: "Alice", age: 30 },
      { id: "b", name: "Bob", age: 25 },
    ];
    const diff = diffEntities(rows, rows);
    expect(diff.inserts).toHaveLength(0);
    expect(diff.updates).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("handles mixed inserts, updates, and deletes", () => {
    const current: EntityRow[] = [
      { id: "keep", value: "same" },
      { id: "change", value: "old" },
      { id: "remove", value: "gone" },
    ];
    const incoming: EntityRow[] = [
      { id: "keep", value: "same" },
      { id: "change", value: "new" },
      { id: "add", value: "fresh" },
    ];
    const diff = diffEntities(current, incoming);
    expect(diff.inserts).toHaveLength(1);
    expect(diff.inserts[0]).toEqual({ id: "add", value: "fresh" });
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]).toEqual({ id: "change", value: "new" });
    expect(diff.deletes).toHaveLength(1);
    expect(diff.deletes[0]).toBe("remove");
  });

  it("golden vector: insert + update + delete + identical rows produce the expected DiffResult", () => {
    const current: EntityRow[] = [
      { id: "identical", name: "Same", score: 5 },
      { id: "to-update", name: "Before", score: 1 },
      { id: "to-delete", name: "Gone", score: 0 },
    ];
    const incoming: EntityRow[] = [
      { id: "identical", name: "Same", score: 5 },
      { id: "to-update", name: "After", score: 2 },
      { id: "to-insert", name: "Fresh", score: 9 },
    ];

    const diff = diffEntities(current, incoming);

    expect(diff).toEqual({
      inserts: [{ id: "to-insert", name: "Fresh", score: 9 }],
      updates: [{ id: "to-update", name: "After", score: 2 }],
      deletes: ["to-delete"],
    });
  });

  it("dedupes duplicate ids in `incoming` last-write-wins (later duplicate supersedes earlier)", () => {
    const current: EntityRow[] = [{ id: "a", name: "Original" }];
    const incoming: EntityRow[] = [
      { id: "a", name: "First" },
      { id: "a", name: "Last" },
    ];

    const diff = diffEntities(current, incoming);

    // Only one update, reflecting the LAST occurrence — the earlier duplicate
    // is silently discarded by the incoming map.
    expect(diff.inserts).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
    expect(diff.updates).toEqual([{ id: "a", name: "Last" }]);
  });
});

// ── toSnakeCase ───────────────────────────────────────────────────────

describe("toSnakeCase", () => {
  it("converts simple camelCase to snake_case", () => {
    expect(toSnakeCase("displayName")).toBe("display_name");
    expect(toSnakeCase("sortOrder")).toBe("sort_order");
    expect(toSnakeCase("createdAt")).toBe("created_at");
    expect(toSnakeCase("systemId")).toBe("system_id");
  });

  it("leaves already-snake_case strings unchanged", () => {
    expect(toSnakeCase("name")).toBe("name");
    expect(toSnakeCase("id")).toBe("id");
  });

  it("handles consecutive uppercase letters", () => {
    expect(toSnakeCase("memberID")).toBe("member_i_d");
  });
});

// ── entityToRow ───────────────────────────────────────────────────────

describe("entityToRow", () => {
  it("converts an entity with simple fields to a row", () => {
    const entity = { name: "Alice", systemId: "sys_1", archived: false };
    const columns = ["id", "name", "system_id", "archived"];
    const row = entityToRow("ent_1", entity, columns);
    expect(row.id).toBe("ent_1");
    expect(row.name).toBe("Alice");
    expect(row.system_id).toBe("sys_1");
    expect(row.archived).toBe(false);
  });

  it("JSON-serializes array fields", () => {
    const entity = { colors: ["red", "blue"] };
    const columns = ["id", "colors"];
    const row = entityToRow("ent_1", entity, columns);
    expect(row.colors).toBe(JSON.stringify(["red", "blue"]));
  });

  it("JSON-serializes object fields", () => {
    const entity = { settings: { theme: "dark" } };
    const columns = ["id", "settings"];
    const row = entityToRow("ent_1", entity, columns);
    expect(row.settings).toBe(JSON.stringify({ theme: "dark" }));
  });

  it("only includes columns in the columnNames list", () => {
    const entity = { name: "Alice", description: "Hi", secretField: "ignore" };
    const columns = ["id", "name", "description"];
    const row = entityToRow("ent_1", entity, columns);
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("name");
    expect(row).toHaveProperty("description");
    expect(row).not.toHaveProperty("secretField");
    expect(row).not.toHaveProperty("secret_field");
  });
});

// ── applyDiff ─────────────────────────────────────────────────────────

interface FakeDb extends MaterializerDb {
  calls: { sql: string; params: unknown[] }[];
  transactionCalled: boolean;
}

function makeDb(): FakeDb {
  const db: FakeDb = {
    calls: [],
    transactionCalled: false,
    queryAll: vi.fn().mockReturnValue([]),
    execute(sql, params) {
      db.calls.push({ sql, params });
    },
    transaction(fn) {
      db.transactionCalled = true;
      return fn();
    },
  };
  return db;
}

function makeMeta(tableName: string, columnNames: readonly string[]): MaterializerTableMetadata {
  return {
    tableName,
    columnNames,
    drizzleTable: {} as MaterializerTableMetadata["drizzleTable"],
  };
}

const META_COLD = makeMeta("members", ["id", "name"]);
const META_HOT = makeMeta("fronting_sessions", ["id", "member_id"]);

describe("applyDiff", () => {
  it("skips when diff is empty", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      { inserts: [], updates: [], deletes: [] },
      eventBus,
    );
    expect(db.calls).toHaveLength(0);
    expect(db.transactionCalled).toBe(false);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("uses INSERT OR REPLACE for inserts", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    const insert: EntityRow = { id: "m_1", name: "Alice" };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      { inserts: [insert], updates: [], deletes: [] },
      eventBus,
    );
    // applyDiff itself does not open a transaction — the caller (subscriber)
    // wraps the whole merge so multi-entity-type merges land atomically.
    expect(db.transactionCalled).toBe(false);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain("INSERT OR REPLACE INTO");
    expect(db.calls[0]?.sql).toContain("members");
  });

  it("uses INSERT OR REPLACE for updates", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    const update: EntityRow = { id: "m_1", name: "Alicia" };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      { inserts: [], updates: [update], deletes: [] },
      eventBus,
    );
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain("INSERT OR REPLACE INTO");
  });

  it("uses DELETE FROM for deletes", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      { inserts: [], updates: [], deletes: ["m_1"] },
      eventBus,
    );
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain("DELETE FROM members WHERE id = ?");
    expect(db.calls[0]?.params).toEqual(["m_1"]);
  });

  it("issues writes without opening its own transaction (caller owns transaction context)", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      {
        inserts: [{ id: "m_1", name: "Alice" }],
        updates: [],
        deletes: ["m_old"],
      },
      eventBus,
    );
    expect(db.transactionCalled).toBe(false);
    // Both writes were issued anyway.
    expect(db.calls).toHaveLength(2);
  });

  it("does not emit entity events for cold-path entities", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_COLD,
      "member",
      "system-core",
      {
        inserts: [{ id: "m_1", name: "Alice" }],
        updates: [{ id: "m_2", name: "Bob" }],
        deletes: ["m_3"],
      },
      eventBus,
    );
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("emits materialized:entity events for hot-path inserts", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_HOT,
      "fronting-session",
      "fronting",
      { inserts: [{ id: "fs_1", member_id: "m_1" }], updates: [], deletes: [] },
      eventBus,
    );
    expect(eventBus.emit).toHaveBeenCalledWith("materialized:entity", {
      type: "materialized:entity",
      documentType: "fronting",
      entityType: "fronting-session",
      entityId: "fs_1",
      op: "create",
    });
  });

  it("emits materialized:entity events for hot-path updates", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_HOT,
      "fronting-session",
      "fronting",
      { inserts: [], updates: [{ id: "fs_1", member_id: "m_1" }], deletes: [] },
      eventBus,
    );
    expect(eventBus.emit).toHaveBeenCalledWith("materialized:entity", {
      type: "materialized:entity",
      documentType: "fronting",
      entityType: "fronting-session",
      entityId: "fs_1",
      op: "update",
    });
  });

  it("emits materialized:entity events for hot-path deletes", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_HOT,
      "fronting-session",
      "fronting",
      { inserts: [], updates: [], deletes: ["fs_1"] },
      eventBus,
    );
    expect(eventBus.emit).toHaveBeenCalledWith("materialized:entity", {
      type: "materialized:entity",
      documentType: "fronting",
      entityType: "fronting-session",
      entityId: "fs_1",
      op: "delete",
    });
  });

  it("does not emit materialized:document from applyDiff", () => {
    const db = makeDb();
    const eventBus = { emit: vi.fn(), on: vi.fn(), removeAll: vi.fn() };
    applyDiff(
      db,
      META_HOT,
      "fronting-session",
      "fronting",
      { inserts: [{ id: "fs_1", member_id: "m_1" }], updates: [], deletes: [] },
      eventBus,
    );
    const documentEmits = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([type]) => type === "materialized:document",
    );
    expect(documentEmits).toHaveLength(0);
  });
});
