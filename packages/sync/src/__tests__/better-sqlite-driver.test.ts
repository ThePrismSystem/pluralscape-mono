/**
 * Tests for the better-sqlite3 test-helper driver.
 *
 * The helper is load-bearing for every adapter contract test in this package,
 * so we cover the transaction error paths (fn-throws-plus-rollback-throws,
 * commit-failure, and nested-transaction guard) directly here.
 */
import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBetterSqliteDriver } from "./better-sqlite-driver.js";

import type { SqliteDriver } from "../adapters/sqlite-driver.js";

/**
 * Wrap a better-sqlite3 Database so `exec` can be intercepted per-SQL.
 * `execOverride` runs before delegating to the real db.exec — throw to
 * simulate a SQLite-level failure on specific SQL like "ROLLBACK" or
 * "COMMIT". The exec call-log is exposed for assertions.
 */
function makeShimmedDriver(
  rawDb: InstanceType<typeof Database>,
  execOverride?: (sql: string) => void,
): { readonly driver: SqliteDriver; readonly execCalls: string[] } {
  const execCalls: string[] = [];
  const proxy = new Proxy(rawDb, {
    get(target, prop, receiver): unknown {
      if (prop === "exec") {
        return (sql: string) => {
          execCalls.push(sql);
          execOverride?.(sql);
          target.exec(sql);
        };
      }
      return Reflect.get(target, prop, receiver) as unknown;
    },
  });
  const driver = createBetterSqliteDriver(proxy);
  return { driver, execCalls };
}

describe("createBetterSqliteDriver transaction error paths", () => {
  let rawDb: InstanceType<typeof Database>;

  beforeEach(() => {
    rawDb = new Database(":memory:");
  });

  afterEach(() => {
    if (rawDb.open) rawDb.close();
  });

  it("throws AggregateError when both fn and ROLLBACK throw", async () => {
    const rollbackErr = new Error("rollback failed");
    const { driver } = makeShimmedDriver(rawDb, (sql) => {
      if (sql === "ROLLBACK") throw rollbackErr;
    });

    const fnErr = new Error("fn failed");
    await expect(driver.transaction(() => Promise.reject(fnErr))).rejects.toMatchObject({
      name: "AggregateError",
      errors: [fnErr, rollbackErr],
    });
  });

  it("propagates COMMIT failure and attempts a ROLLBACK", async () => {
    const commitErr = new Error("commit failed");
    const { driver, execCalls } = makeShimmedDriver(rawDb, (sql) => {
      if (sql === "COMMIT") throw commitErr;
    });

    await expect(driver.transaction(() => Promise.resolve("ok"))).rejects.toBe(commitErr);
    expect(execCalls).toContain("BEGIN");
    expect(execCalls).toContain("COMMIT");
    expect(execCalls).toContain("ROLLBACK");
  });

  it("wraps COMMIT and ROLLBACK errors in AggregateError when both fail", async () => {
    const commitErr = new Error("commit failed");
    const rollbackErr = new Error("rollback failed");
    const { driver } = makeShimmedDriver(rawDb, (sql) => {
      if (sql === "COMMIT") throw commitErr;
      if (sql === "ROLLBACK") throw rollbackErr;
    });

    await expect(driver.transaction(() => Promise.resolve("ok"))).rejects.toMatchObject({
      name: "AggregateError",
      errors: [commitErr, rollbackErr],
    });
  });

  it("rejects nested transactions with a clear error", async () => {
    const { driver } = makeShimmedDriver(rawDb);
    await expect(
      driver.transaction(async () => {
        await driver.transaction(() => Promise.resolve("inner"));
      }),
    ).rejects.toThrow(/nested transactions are not supported/);
  });
});
