import { generateAllDdl } from "@pluralscape/sync/materializer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalDatabase } from "../local-database.js";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

vi.mock("@pluralscape/sync/materializer", () => ({
  generateAllDdl: vi.fn(() => ["CREATE TABLE a (id TEXT)", "CREATE TABLE b (id TEXT)"]),
}));

/**
 * Builds a mock SqliteDriver whose methods are vi spies.
 *
 * Because SqliteDriver.prepare is generic (`<TRow>`), a plain object literal
 * cannot satisfy the signature without a cast. We build the mock with concrete
 * return types, then widen to SqliteDriver via a helper.
 */
function createMockDriver() {
  const stmt = {
    run: vi.fn(),
    all: vi.fn((): Record<string, unknown>[] => []),
    get: vi.fn((): Record<string, unknown> | undefined => undefined),
  };

  const execSpy = vi.fn();
  const prepareSpy = vi.fn(() => stmt);
  const transactionSpy = vi.fn(<T>(fn: () => T): T => fn());
  const closeSpy = vi.fn();

  // SqliteDriver.prepare and .transaction are generic methods whose type
  // parameters cannot be captured by vi.fn(). Wrapping in arrow functions
  // satisfies the interface while keeping spies accessible on the harness.
  const driver: SqliteDriver = {
    exec: execSpy,
    prepare: prepareSpy as SqliteDriver["prepare"],
    transaction: transactionSpy as SqliteDriver["transaction"],
    close: closeSpy,
  };

  return { driver, stmt, execSpy, prepareSpy, transactionSpy, closeSpy };
}

type MockHarness = ReturnType<typeof createMockDriver>;

describe("createLocalDatabase", () => {
  let m: MockHarness;

  beforeEach(() => {
    m = createMockDriver();
    vi.mocked(generateAllDdl).mockReturnValue([
      "CREATE TABLE a (id TEXT)",
      "CREATE TABLE b (id TEXT)",
    ]);
  });

  describe("initialize()", () => {
    it("sets WAL journal mode first", () => {
      const db = createLocalDatabase(m.driver);
      db.initialize();
      expect(m.execSpy).toHaveBeenNthCalledWith(1, "PRAGMA journal_mode=WAL");
    });

    it("executes all DDL statements from generateAllDdl", () => {
      const db = createLocalDatabase(m.driver);
      db.initialize();
      expect(m.execSpy).toHaveBeenCalledWith("CREATE TABLE a (id TEXT)");
      expect(m.execSpy).toHaveBeenCalledWith("CREATE TABLE b (id TEXT)");
    });

    it("calls driver.exec once per DDL statement plus the WAL pragma", () => {
      const db = createLocalDatabase(m.driver);
      db.initialize();
      expect(m.execSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("queryAll()", () => {
    it("prepares the statement and returns all rows", () => {
      const rows = [{ id: "1" }, { id: "2" }];
      m.stmt.all.mockReturnValueOnce(rows);

      const db = createLocalDatabase(m.driver);
      const result = db.queryAll("SELECT * FROM a", []);

      expect(m.prepareSpy).toHaveBeenCalledWith("SELECT * FROM a");
      expect(result).toEqual(rows);
    });

    it("passes params to the prepared statement", () => {
      const db = createLocalDatabase(m.driver);
      db.queryAll("SELECT * FROM a WHERE id = ?", ["abc"]);

      expect(m.stmt.all).toHaveBeenCalledWith("abc");
    });
  });

  describe("queryOne()", () => {
    it("prepares the statement and returns a single row", () => {
      const row = { id: "1" };
      m.stmt.get.mockReturnValueOnce(row);

      const db = createLocalDatabase(m.driver);
      const result = db.queryOne("SELECT * FROM a WHERE id = ?", ["1"]);

      expect(m.prepareSpy).toHaveBeenCalledWith("SELECT * FROM a WHERE id = ?");
      expect(m.stmt.get).toHaveBeenCalledWith("1");
      expect(result).toEqual(row);
    });

    it("returns undefined when no row is found", () => {
      const db = createLocalDatabase(m.driver);
      const result = db.queryOne("SELECT * FROM a WHERE id = ?", ["missing"]);
      expect(result).toBeUndefined();
    });
  });

  describe("execute()", () => {
    it("prepares and runs the statement with params", () => {
      const db = createLocalDatabase(m.driver);
      db.execute("INSERT INTO a (id) VALUES (?)", ["x"]);

      expect(m.prepareSpy).toHaveBeenCalledWith("INSERT INTO a (id) VALUES (?)");
      expect(m.stmt.run).toHaveBeenCalledWith("x");
    });
  });

  describe("transaction()", () => {
    it("delegates to driver.transaction and returns the fn result", () => {
      const db = createLocalDatabase(m.driver);
      const result = db.transaction(() => 42);
      expect(m.transactionSpy).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it("wraps the provided function inside driver.transaction", () => {
      const fn = vi.fn(() => "done");
      const db = createLocalDatabase(m.driver);
      db.transaction(fn);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe("close()", () => {
    it("delegates to driver.close", () => {
      const db = createLocalDatabase(m.driver);
      db.close();
      expect(m.closeSpy).toHaveBeenCalledOnce();
    });
  });
});
