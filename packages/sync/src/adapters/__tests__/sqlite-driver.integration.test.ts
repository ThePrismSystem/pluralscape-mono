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

/**
 * Build a BunSqliteDatabase-shaped adapter around better-sqlite3.
 *
 * `execOverride`, when provided, runs before delegating to the real db.exec —
 * it can throw to simulate a SQLite-level failure on specific SQL (e.g.
 * "ROLLBACK" or "COMMIT"). The exec call-log is exposed for assertions.
 */
function makeBunShim(
  db: InstanceType<typeof Database>,
  execOverride?: (sql: string) => void,
): {
  readonly shim: {
    prepare(sql: string): {
      run(...params: unknown[]): void;
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    };
    exec(sql: string): void;
    close(): void;
  };
  readonly execCalls: string[];
} {
  const execCalls: string[] = [];
  const shim = {
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
      execCalls.push(sql);
      execOverride?.(sql);
      db.exec(sql);
    },
    close(): void {
      db.close();
    },
  };
  return { shim, execCalls };
}

describe("createBunSqliteDriver", () => {
  let rawDb: InstanceType<typeof Database>;
  let driver: SqliteDriver;

  beforeEach(async () => {
    rawDb = new Database(":memory:");
    driver = createBunSqliteDriver(makeBunShim(rawDb).shim);
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

  describe("transaction error paths", () => {
    it("throws AggregateError when both fn and ROLLBACK throw", async () => {
      const rollbackErr = new Error("rollback failed");
      const { shim } = makeBunShim(rawDb, (sql) => {
        if (sql === "ROLLBACK") throw rollbackErr;
      });
      const failingDriver = createBunSqliteDriver(shim);

      const fnErr = new Error("fn failed");
      await expect(failingDriver.transaction(() => Promise.reject(fnErr))).rejects.toMatchObject({
        name: "AggregateError",
        errors: [fnErr, rollbackErr],
      });
    });

    it("propagates COMMIT failure and attempts a ROLLBACK", async () => {
      const commitErr = new Error("commit failed");
      const { shim, execCalls } = makeBunShim(rawDb, (sql) => {
        if (sql === "COMMIT") throw commitErr;
      });
      const failingDriver = createBunSqliteDriver(shim);

      await expect(failingDriver.transaction(() => Promise.resolve("ok"))).rejects.toBe(commitErr);
      expect(execCalls).toContain("BEGIN");
      expect(execCalls).toContain("COMMIT");
      expect(execCalls).toContain("ROLLBACK");
    });

    it("wraps COMMIT and ROLLBACK errors in AggregateError when both fail", async () => {
      const commitErr = new Error("commit failed");
      const rollbackErr = new Error("rollback failed");
      const { shim } = makeBunShim(rawDb, (sql) => {
        if (sql === "COMMIT") throw commitErr;
        if (sql === "ROLLBACK") throw rollbackErr;
      });
      const failingDriver = createBunSqliteDriver(shim);

      await expect(failingDriver.transaction(() => Promise.resolve("ok"))).rejects.toMatchObject({
        name: "AggregateError",
        errors: [commitErr, rollbackErr],
      });
    });

    it("rejects nested transactions with a clear error", async () => {
      await expect(
        driver.transaction(async () => {
          await driver.transaction(() => Promise.resolve("inner"));
        }),
      ).rejects.toThrow(/nested transactions are not supported/);
    });
  });
});
