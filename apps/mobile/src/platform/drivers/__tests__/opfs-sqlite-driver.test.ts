import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExec = vi.fn<
  [number, string, ((row: unknown[], columns: string[]) => void)?],
  Promise<number>
>();
const mockClose = vi.fn<[number], Promise<number>>();
const mockOpenV2 = vi.fn<[string, number?, string?], Promise<number>>();
const mockVfsRegister = vi.fn<[object, boolean?], number>();

const mockSqlite3: WaSqliteAPI = {
  exec: mockExec,
  close: mockClose,
  open_v2: mockOpenV2,
  vfs_register: mockVfsRegister,
};

vi.mock("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs", () => ({
  default: vi.fn().mockResolvedValue({ _brand: Symbol("mock") }),
}));

vi.mock("@journeyapps/wa-sqlite", () => ({
  Factory: vi.fn().mockReturnValue(mockSqlite3),
}));

vi.mock("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js", () => ({
  OPFSCoopSyncVFS: {
    create: vi.fn().mockResolvedValue({ _opfsBrand: Symbol("mock-vfs") }),
  },
}));

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

    it("throws when params are passed", () => {
      const stmt = driver.prepare("INSERT INTO t VALUES (?)");
      expect(() => {
        stmt.run("val");
      }).toThrow("parameterized queries not yet implemented");
    });
  });

  describe("prepare().all()", () => {
    it("accumulates rows from the exec callback", () => {
      mockExec.mockImplementation(
        (_db: number, _sql: string, callback?: (row: unknown[], columns: string[]) => void) => {
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

    it("returns empty array when no rows", () => {
      const stmt = driver.prepare("SELECT * FROM t");
      const rows = stmt.all();
      expect(rows).toEqual([]);
    });

    it("throws when params are passed", () => {
      const stmt = driver.prepare("SELECT * FROM t WHERE id = ?");
      expect(() => stmt.all(1)).toThrow("parameterized queries not yet implemented");
    });
  });

  describe("prepare().get()", () => {
    it("returns the first row", () => {
      mockExec.mockImplementation(
        (_db: number, _sql: string, callback?: (row: unknown[], columns: string[]) => void) => {
          callback?.(["Alice", 30], ["name", "age"]);
          callback?.(["Bob", 25], ["name", "age"]);
          return Promise.resolve(0);
        },
      );

      const stmt = driver.prepare<{ name: string; age: number }>("SELECT * FROM t LIMIT 1");
      const row = stmt.get();
      expect(row).toEqual({ name: "Alice", age: 30 });
    });

    it("returns undefined when no rows", () => {
      const stmt = driver.prepare("SELECT * FROM t");
      expect(stmt.get()).toBeUndefined();
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
