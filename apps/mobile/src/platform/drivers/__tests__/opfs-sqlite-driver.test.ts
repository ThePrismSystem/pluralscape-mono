import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOpfsSqliteDriver } from "../opfs-sqlite-driver.js";
import { SQLITE_DONE, SQLITE_OK, SQLITE_ROW } from "../wa-sqlite.constants.js";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

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
  SQLITE_ROW: SQLITE_ROW,
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
      mockStep.mockResolvedValue(SQLITE_DONE);

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
      mockStep.mockResolvedValue(SQLITE_DONE);

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

    it("rejects Date as bind parameter", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(SQLITE_OK);
      mockStep.mockResolvedValue(SQLITE_DONE);

      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      stmt.run(new Date());
      await expect(driver.flush()).rejects.toThrow(/unsupported bind type.*Date/);
    });

    it("rejects plain object as bind parameter", async () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      stmt.run({ key: "value" });
      await expect(driver.flush()).rejects.toThrow(/unsupported bind type/);
    });

    it("rejects function as bind parameter", async () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      stmt.run(() => "x");
      await expect(driver.flush()).rejects.toThrow(/unsupported bind type.*function/);
    });

    it("includes the parameter index in the unsupported-type error", async () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (?, ?)");
      stmt.run("ok", new Date());
      await expect(driver.flush()).rejects.toThrow(/index 1/);
    });

    it("surfaces bind_collection failure via flush()", async () => {
      const stmtHandle = 42;
      mockStatements.mockReturnValue(mockStatementsIterator(stmtHandle));
      mockBindCollection.mockReturnValue(1); // SQLITE_ERROR
      mockStep.mockResolvedValue(SQLITE_DONE);

      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      stmt.run("x");
      await expect(driver.flush()).rejects.toThrow(/bind_collection failed.*rc=1/);
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

    it("throws when called with params (Worker bridge required)", () => {
      const stmt = driver.prepare("SELECT * FROM t WHERE id = ?");
      expect(() => stmt.all(1)).toThrow(
        /parameterized .all\(\) not yet supported.*Worker bridge.*mobile-shr0/,
      );
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

    it("throws when called with params (Worker bridge required)", () => {
      const stmt = driver.prepare("SELECT * FROM t WHERE id = ?");
      expect(() => stmt.get(1)).toThrow(
        /parameterized .get\(\) not yet supported.*Worker bridge.*mobile-shr0/,
      );
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

    it("calls onDroppedError when an earlier error is overwritten", async () => {
      const onDroppedError = vi.fn<(err: Error) => void>();
      const driverWithHook = await createOpfsSqliteDriver({ onDroppedError });

      // Use a manually-resolved reject so we control exactly when the .catch fires
      let rejectFirst!: (err: Error) => void;
      let rejectSecond!: (err: Error) => void;
      const firstPromise = new Promise<number>((_res, rej) => {
        rejectFirst = rej;
      });
      const secondPromise = new Promise<number>((_res, rej) => {
        rejectSecond = rej;
      });

      mockExec
        .mockImplementationOnce(() => firstPromise)
        .mockImplementationOnce(() => secondPromise);

      // Fire both execs synchronously so neither checkLastError call sees a stored error
      driverWithHook.exec("FIRST");
      driverWithHook.exec("SECOND");

      // Now reject both — first lands, then second triggers the overwrite path
      rejectFirst(new Error("first"));
      rejectSecond(new Error("second"));
      await new Promise((r) => setTimeout(r, 0));

      expect(onDroppedError).toHaveBeenCalledWith(expect.objectContaining({ message: "first" }));

      // Drain the lastError so other tests start clean
      await driverWithHook.flush().catch(() => undefined);
    });
  });
});
