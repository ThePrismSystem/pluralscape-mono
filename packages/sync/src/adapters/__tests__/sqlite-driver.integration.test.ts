/**
 * Integration tests for createBunSqliteDriver.
 * The factory accepts any object matching BunSqliteDatabase's shape, so we
 * back it with a real better-sqlite3-multiple-ciphers in-memory DB to exercise
 * every wrapper branch without requiring bun:sqlite at runtime.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBunSqliteDriver } from "../sqlite-driver.js";

import type { SqliteDriver } from "../sqlite-driver.js";

/** Build a BunSqliteDatabase-shaped adapter around better-sqlite3. */
function makeBunShim(db: InstanceType<typeof Database>) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): void {
          stmt.run(...params);
        },
        all(...params: unknown[]): unknown[] {
          return stmt.all(...params);
        },
        get(...params: unknown[]): unknown {
          // better-sqlite3 returns undefined for missing rows; bun:sqlite
          // returns null.  Mimic bun:sqlite so the driver's `?? undefined`
          // branch is exercised by returning null when nothing is found.
          const row = stmt.get(...params);
          return row === undefined ? null : row;
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): () => T {
      return db.transaction(fn) as () => T;
    },
    close(): void {
      db.close();
    },
  };
}

describe("createBunSqliteDriver", () => {
  let rawDb: InstanceType<typeof Database>;
  let driver: SqliteDriver;

  beforeEach(async () => {
    rawDb = new Database(":memory:");
    driver = createBunSqliteDriver(makeBunShim(rawDb));
    await driver.exec("CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)");
  });

  afterEach(() => {
    if (rawDb.open) rawDb.close();
  });

  it("exec runs DDL without throwing", async () => {
    // Already ran in beforeEach; run another DDL to confirm it works
    await driver.exec("CREATE TABLE IF NOT EXISTS extra (id INTEGER PRIMARY KEY)");
  });

  it("prepare + run inserts a row", async () => {
    const insert = driver.prepare("INSERT INTO kv (k, v) VALUES (?, ?)");
    await insert.run("hello", "world");

    const select = driver.prepare<{ k: string; v: string }>("SELECT k, v FROM kv WHERE k = ?");
    const row = await select.get("hello");
    expect(row).toEqual({ k: "hello", v: "world" });
  });

  it("prepare + get returns undefined when row is absent (null → undefined branch)", async () => {
    const select = driver.prepare<{ k: string; v: string }>("SELECT k, v FROM kv WHERE k = ?");
    const row = await select.get("missing");
    expect(row).toBeUndefined();
  });

  it("prepare + all returns an array of matching rows", async () => {
    const insert = driver.prepare("INSERT INTO kv (k, v) VALUES (?, ?)");
    await insert.run("a", "1");
    await insert.run("b", "2");

    const rows = await driver
      .prepare<{ k: string; v: string }>("SELECT k, v FROM kv ORDER BY k")
      .all();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ k: "a", v: "1" });
    expect(rows[1]).toEqual({ k: "b", v: "2" });
  });

  it("prepare + all with params filters rows", async () => {
    const insert = driver.prepare("INSERT INTO kv (k, v) VALUES (?, ?)");
    await insert.run("x", "10");
    await insert.run("y", "20");

    const rows = await driver
      .prepare<{ k: string; v: string }>("SELECT k, v FROM kv WHERE k = ?")
      .all("x");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ k: "x", v: "10" });
  });

  it("transaction commits on success", async () => {
    const result = await driver.transaction(async () => {
      await driver.prepare("INSERT INTO kv (k, v) VALUES (?, ?)").run("tx-key", "tx-val");
      return "ok";
    });

    expect(result).toBe("ok");
    const row = await driver.prepare<{ v: string }>("SELECT v FROM kv WHERE k = ?").get("tx-key");
    expect(row?.v).toBe("tx-val");
  });

  it("transaction rolls back on throw", async () => {
    await expect(
      driver.transaction(async () => {
        await driver.prepare("INSERT INTO kv (k, v) VALUES (?, ?)").run("rollback-key", "val");
        throw new Error("intentional rollback");
      }),
    ).rejects.toThrow("intentional rollback");

    const row = await driver
      .prepare<{ v: string }>("SELECT v FROM kv WHERE k = ?")
      .get("rollback-key");
    expect(row).toBeUndefined();
  });

  it("close does not throw", async () => {
    await driver.close();
    // Mark rawDb as closed so afterEach does not double-close
    // (rawDb.open will be false after driver.close() calls db.close())
  });
});
