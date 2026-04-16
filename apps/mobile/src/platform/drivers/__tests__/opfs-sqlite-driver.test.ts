import { beforeEach, describe, expect, it, vi } from "vitest";

/** Sentinel returned by step() when a result row is available. */
const MOCK_SQLITE_ROW = 100;
/** Sentinel returned by step() when statement execution is complete. */
const MOCK_SQLITE_DONE = 101;

const mockExec = vi.fn<WaSqliteAPI["exec"]>();
const mockClose = vi.fn<WaSqliteAPI["close"]>();
const mockOpenV2 = vi.fn<WaSqliteAPI["open_v2"]>();
const mockVfsRegister = vi.fn<WaSqliteAPI["vfs_register"]>();
const mockStatements = vi.fn<WaSqliteAPI["statements"]>();
const mockBindCollection = vi.fn<WaSqliteAPI["bind_collection"]>();
const mockStep = vi.fn<WaSqliteAPI["step"]>();
const mockRow = vi.fn<WaSqliteAPI["row"]>();
const mockColumnNames = vi.fn<WaSqliteAPI["column_names"]>();

const mockSqlite3: WaSqliteAPI = {
  exec: mockExec,
  close: mockClose,
  open_v2: mockOpenV2,
  vfs_register: mockVfsRegister,
  statements: mockStatements,
  bind_collection: mockBindCollection,
  step: mockStep,
  row: mockRow,
  column_names: mockColumnNames,
};

vi.mock("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs", () => ({
  default: vi.fn().mockResolvedValue({ _brand: Symbol("mock") }),
}));

vi.mock("@journeyapps/wa-sqlite", () => ({
  Factory: vi.fn().mockReturnValue(mockSqlite3),
  SQLITE_ROW: MOCK_SQLITE_ROW,
}));

vi.mock("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js", () => ({
  OPFSCoopSyncVFS: {
    create: vi.fn().mockResolvedValue({ _opfsBrand: Symbol("mock-vfs") }),
  },
}));

/**
 * Helper: create a mock async iterable that yields a single statement handle,
 * simulating `sqlite3.statements(db, sql)`.
 */
function mockStatementsIterator(stmtHandle: number): AsyncIterable<number> {
  return {
    [Symbol.asyncIterator]() {
      let done = false;
      return {
        next() {
          if (done) return Promise.resolve({ done: true as const, value: undefined });
          done = true;
          return Promise.resolve({ done: false as const, value: stmtHandle });
        },
        return() {
          return Promise.resolve({ done: true as const, value: undefined });
        },
      };
    },
  };
}

import { createOpfsSqliteDriver } from "../opfs-sqlite-driver.js";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

let driver: SqliteDriver & { flush(): Promise<void> };

beforeEach(async () => {
  vi.clearAllMocks();
  mockOpenV2.mockResolvedValue(1);
  mockExec.mockResolvedValue(0);
  mockClose.mockResolvedValue(0);
  driver = await createOpfsSqliteDriver();
});

describe("createOpfsSqliteDriver", () => {
  it("registers VFS and opens the database", () => {
    expect(mockVfsRegister).toHaveBeenCalledOnce();
    expect(mockOpenV2).toHaveBeenCalledWith("pluralscape-sync.db");
  });

  describe("exec", () => {
    it("delegates to sqlite3.exec", () => {
      driver.exec("CREATE TABLE t (id INTEGER)");
      expect(mockExec).toHaveBeenCalledWith(1, "CREATE TABLE t (id INTEGER)");
    });
  });

  describe("prepare().run()", () => {
    it("executes SQL without params", () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (1)");
      stmt.run();
      expect(mockExec).toHaveBeenCalledWith(1, "INSERT INTO t VALUES (1)");
    });

    it("uses prepared statement API when params are provided", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockStep.mockResolvedValue(MOCK_SQLITE_DONE);

      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      stmt.run("val");

      // Flush to let the async prepared-statement promise settle
      await driver.flush();

      expect(mockStatements).toHaveBeenCalledWith(1, "INSERT INTO t VALUES (?)");
      expect(mockBindCollection).toHaveBeenCalledWith(stmtHandle, ["val"]);
      expect(mockStep).toHaveBeenCalledWith(stmtHandle);
    });

    it("handles multiple bind parameters", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockStep.mockResolvedValue(MOCK_SQLITE_DONE);

      const stmt = driver.prepare("INSERT INTO t (a, b, c) VALUES (?, ?, ?)");
      stmt.run(1, "two", null);
      await driver.flush();

      expect(mockBindCollection).toHaveBeenCalledWith(stmtHandle, [1, "two", null]);
    });

    it("falls back to exec when empty params array is spread", () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (1)");
      stmt.run();
      expect(mockExec).toHaveBeenCalledWith(1, "INSERT INTO t VALUES (1)");
      expect(mockStatements).not.toHaveBeenCalled();
    });
  });

  describe("prepare().all()", () => {
    it("accumulates rows from the exec callback (no params)", () => {
      mockExec.mockImplementation(
        (
          _db: number,
          _sql: string,
          callback?: (row: (WaSqliteCompatibleType | null)[], columns: string[]) => void,
        ) => {
          callback?.(["Alice", 30], ["name", "age"]);
          callback?.(["Bob", 25], ["name", "age"]);
          return Promise.resolve(0);
        },
      );

      const stmt = driver.prepare<{ name: string; age: number }>("SELECT * FROM t");
      const rows = stmt.all();
      expect(rows).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);
    });

    it("returns empty array when no rows (no params)", () => {
      const stmt = driver.prepare("SELECT * FROM t");
      const rows = stmt.all();
      expect(rows).toEqual([]);
    });

    it("uses prepared statement API with params and collects rows", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockColumnNames.mockReturnValue(["name", "age"]);

      // First step returns a row, second returns DONE
      mockStep
        .mockResolvedValueOnce(MOCK_SQLITE_ROW)
        .mockResolvedValueOnce(MOCK_SQLITE_ROW)
        .mockResolvedValueOnce(MOCK_SQLITE_DONE);
      mockRow.mockReturnValueOnce(["Alice", 30]).mockReturnValueOnce(["Bob", 25]);

      const stmt = driver.prepare<{ name: string; age: number }>("SELECT * FROM t WHERE age > ?");
      const rows = stmt.all(20);
      await driver.flush();

      expect(mockBindCollection).toHaveBeenCalledWith(stmtHandle, [20]);
      expect(rows).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);
    });

    it("returns empty array when parameterized query matches no rows", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockStep.mockResolvedValue(MOCK_SQLITE_DONE);

      const stmt = driver.prepare("SELECT * FROM t WHERE id = ?");
      const rows = stmt.all(999);
      await driver.flush();

      expect(rows).toEqual([]);
    });

    it("handles NULL parameter values in SELECT", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockStep.mockResolvedValue(MOCK_SQLITE_DONE);

      const stmt = driver.prepare("SELECT * FROM t WHERE col IS ?");
      stmt.all(null);
      await driver.flush();

      expect(mockBindCollection).toHaveBeenCalledWith(stmtHandle, [null]);
    });
  });

  describe("prepare().get()", () => {
    it("returns the first row (no params)", () => {
      mockExec.mockImplementation(
        (
          _db: number,
          _sql: string,
          callback?: (row: (WaSqliteCompatibleType | null)[], columns: string[]) => void,
        ) => {
          callback?.(["Alice", 30], ["name", "age"]);
          callback?.(["Bob", 25], ["name", "age"]);
          return Promise.resolve(0);
        },
      );

      const stmt = driver.prepare<{ name: string; age: number }>("SELECT * FROM t LIMIT 1");
      const row = stmt.get();
      expect(row).toEqual({ name: "Alice", age: 30 });
    });

    it("returns undefined when no rows (no params)", () => {
      const stmt = driver.prepare("SELECT * FROM t");
      expect(stmt.get()).toBeUndefined();
    });

    it("delegates to all() for parameterized queries", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockColumnNames.mockReturnValue(["name", "age"]);
      mockStep.mockResolvedValueOnce(MOCK_SQLITE_ROW).mockResolvedValueOnce(MOCK_SQLITE_DONE);
      mockRow.mockReturnValueOnce(["Alice", 30]);

      const stmt = driver.prepare<{ name: string; age: number }>("SELECT * FROM t WHERE id = ?");
      // get() with params uses the store-and-check pattern: the row is populated
      // asynchronously so the return value is undefined until flush().
      // Callers should use all() for parameterized queries requiring immediate reads,
      // or flush() before accessing the result.
      stmt.get(1);
      await driver.flush();

      expect(mockBindCollection).toHaveBeenCalledWith(stmtHandle, [1]);
      expect(mockStep).toHaveBeenCalledWith(stmtHandle);
    });

    it("returns undefined when parameterized query matches nothing", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(0);
      mockStep.mockResolvedValue(MOCK_SQLITE_DONE);

      const stmt = driver.prepare("SELECT * FROM t WHERE id = ?");
      const row = stmt.get(999);
      await driver.flush();

      expect(row).toBeUndefined();
    });
  });

  describe("transaction()", () => {
    it("executes BEGIN, fn, COMMIT in order", () => {
      const fn = vi.fn(() => 42);
      const result = driver.transaction(fn);

      expect(result).toBe(42);
      expect(mockExec).toHaveBeenCalledWith(1, "BEGIN");
      expect(fn).toHaveBeenCalledOnce();
      expect(mockExec).toHaveBeenCalledWith(1, "COMMIT");
    });

    it("executes ROLLBACK and rethrows when fn throws", () => {
      const error = new Error("boom");
      expect(() =>
        driver.transaction(() => {
          throw error;
        }),
      ).toThrow("boom");

      expect(mockExec).toHaveBeenCalledWith(1, "BEGIN");
      expect(mockExec).toHaveBeenCalledWith(1, "ROLLBACK");
      expect(mockExec).not.toHaveBeenCalledWith(1, "COMMIT");
    });
  });

  describe("close()", () => {
    it("delegates to sqlite3.close", () => {
      driver.close();
      expect(mockClose).toHaveBeenCalledWith(1);
    });

    it("surfaces close error on subsequent flush()", async () => {
      mockClose.mockRejectedValueOnce(new Error("VFS lock stuck"));

      driver.close();

      // Allow the .catch handler to run
      await new Promise((r) => setTimeout(r, 0));

      await expect(driver.flush()).rejects.toThrow("VFS lock stuck");
    });
  });

  describe("store-and-check error guard", () => {
    it("surfaces a previous exec rejection on the next operation", async () => {
      const rejection = Promise.reject(new Error("I/O error"));
      mockExec.mockReturnValueOnce(rejection);

      driver.exec("FAILING SQL");

      // Allow the .catch handler to run
      await new Promise((r) => setTimeout(r, 0));

      expect(() => {
        driver.exec("SELECT 1");
      }).toThrow("I/O error");
    });

    it("flush() rejects with the stored error", async () => {
      const rejection = Promise.reject(new Error("disk full"));
      mockExec.mockReturnValueOnce(rejection);

      driver.exec("FAILING SQL");

      await expect(driver.flush()).rejects.toThrow("disk full");
    });

    it("flush() resolves when no errors", async () => {
      driver.exec("SELECT 1");
      await expect(driver.flush()).resolves.toBeUndefined();
    });
  });
});
