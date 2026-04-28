import Database from "better-sqlite3-multiple-ciphers";
import { describe, expect, it } from "vitest";

import { generateAllDdl } from "../local-schema.js";

describe("generateAllDdl runtime validity", () => {
  it("produces SQL that better-sqlite3 can execute against an in-memory database", () => {
    const db = new Database(":memory:");
    const ddl = generateAllDdl();

    for (const stmt of ddl) {
      // db.exec runs each statement; if any fails, this throws and the test
      // surfaces the offending DDL (column-order, default literal, FK syntax,
      // FTS quoting — anything the static unit tests cannot catch).
      expect(() => db.exec(stmt)).not.toThrow();
    }

    const objects = db
      .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')")
      .all() as { name: string; type: string }[];

    // crdt_documents + ~40 cache tables + ~20 friend_ tables + FTS5 internals
    // (each VIRTUAL TABLE materialises ~5 shadow tables) + triggers — well
    // above 80 SQLite-master rows. The exact count drifts as schemas evolve;
    // the lower bound just guards against the case where DDL silently no-ops.
    expect(objects.length).toBeGreaterThan(80);

    // Every emitted CREATE TABLE IF NOT EXISTS for an own/friend cache table
    // must produce a row in sqlite_master.
    const expectedTableNames = ddl
      .filter((s) => s.startsWith("CREATE TABLE IF NOT EXISTS "))
      .map((s) => {
        const match = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(s);
        return match?.[1] ?? "";
      });
    const actualTableNames = new Set(objects.filter((o) => o.type === "table").map((o) => o.name));
    for (const expected of expectedTableNames) {
      expect(actualTableNames.has(expected)).toBe(true);
    }

    db.close();
  });
});
