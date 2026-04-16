import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted — all mock fns must come from vi.hoisted()
const {
  mockFinalizeSync,
  mockGetFirstSync,
  mockGetAllSync,
  mockExecuteSync,
  mockPrepareSync,
  mockExecSync,
  mockCloseSync,
  mockDeleteDatabaseSync,
  mockOpenDatabaseSync,
} = vi.hoisted(() => {
  const mockFinalizeSync = vi.fn();
  const mockGetFirstSync = vi.fn<() => Record<string, unknown> | null>(() => null);
  const mockGetAllSync = vi.fn<() => Record<string, unknown>[]>(() => []);
  const mockExecuteSync = vi.fn(() => ({
    getAllSync: mockGetAllSync,
    getFirstSync: mockGetFirstSync,
  }));
  const mockPrepareSync = vi.fn(() => ({
    executeSync: mockExecuteSync,
    finalizeSync: mockFinalizeSync,
  }));
  const mockExecSync = vi.fn();
  const mockCloseSync = vi.fn();
  const mockDeleteDatabaseSync = vi.fn();
  const mockOpenDatabaseSync = vi.fn(() => ({
    prepareSync: mockPrepareSync,
    execSync: mockExecSync,
    closeSync: mockCloseSync,
  }));

  return {
    mockFinalizeSync,
    mockGetFirstSync,
    mockGetAllSync,
    mockExecuteSync,
    mockPrepareSync,
    mockExecSync,
    mockCloseSync,
    mockDeleteDatabaseSync,
    mockOpenDatabaseSync,
  };
});

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: mockOpenDatabaseSync,
  deleteDatabaseSync: mockDeleteDatabaseSync,
}));

import {
  createExpoSqliteDriver,
  DB_ENCRYPTION_KDF_CONTEXT,
  DB_ENCRYPTION_KEY_BYTES,
  DB_ENCRYPTION_SUBKEY_ID,
} from "../expo-sqlite-driver.js";

describe("createExpoSqliteDriver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an object implementing SqliteDriver", async () => {
    const driver = await createExpoSqliteDriver();
    expect(driver).toHaveProperty("prepare");
    expect(driver).toHaveProperty("exec");
    expect(driver).toHaveProperty("transaction");
    expect(driver).toHaveProperty("close");
  });

  it("prepare returns a statement with run, all, get methods", async () => {
    const driver = await createExpoSqliteDriver();
    const stmt = driver.prepare("SELECT 1");
    expect(stmt).toHaveProperty("run");
    expect(stmt).toHaveProperty("all");
    expect(stmt).toHaveProperty("get");
  });

  describe("exec()", () => {
    it("delegates to db.execSync()", async () => {
      const driver = await createExpoSqliteDriver();
      await driver.exec("CREATE TABLE t (id INTEGER)");
      expect(mockExecSync).toHaveBeenCalledWith("CREATE TABLE t (id INTEGER)");
    });
  });

  describe("close()", () => {
    it("delegates to db.closeSync()", async () => {
      const driver = await createExpoSqliteDriver();
      await driver.close();
      expect(mockCloseSync).toHaveBeenCalledOnce();
    });
  });

  describe("transaction()", () => {
    it("issues BEGIN/COMMIT and returns fn result on success", async () => {
      const driver = await createExpoSqliteDriver();
      const result = await driver.transaction(() => Promise.resolve(42));
      expect(mockExecSync).toHaveBeenCalledWith("BEGIN");
      expect(mockExecSync).toHaveBeenCalledWith("COMMIT");
      expect(mockExecSync).not.toHaveBeenCalledWith("ROLLBACK");
      expect(result).toBe(42);
    });

    it("issues ROLLBACK and rethrows when fn throws", async () => {
      const driver = await createExpoSqliteDriver();
      const failure = new Error("fn failed");
      await expect(driver.transaction(() => Promise.reject(failure))).rejects.toBe(failure);
      expect(mockExecSync).toHaveBeenCalledWith("BEGIN");
      expect(mockExecSync).toHaveBeenCalledWith("ROLLBACK");
      expect(mockExecSync).not.toHaveBeenCalledWith("COMMIT");
    });

    it("throws AggregateError when both fn and ROLLBACK throw", async () => {
      const driver = await createExpoSqliteDriver();
      const failure = new Error("fn failed");
      const rollbackFailure = new Error("rollback failed");
      mockExecSync.mockImplementation((sql: string) => {
        if (sql === "ROLLBACK") {
          throw rollbackFailure;
        }
      });
      await expect(driver.transaction(() => Promise.reject(failure))).rejects.toMatchObject({
        name: "AggregateError",
        errors: [failure, rollbackFailure],
      });
    });
  });

  describe("prepare().run()", () => {
    it("prepares, executes, and finalizes the statement", async () => {
      const driver = await createExpoSqliteDriver();
      await driver.prepare("INSERT INTO t VALUES (?)").run(1);
      expect(mockPrepareSync).toHaveBeenCalledWith("INSERT INTO t VALUES (?)");
      expect(mockExecuteSync).toHaveBeenCalledWith([1]);
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });

  describe("prepare().all()", () => {
    it("returns all rows and finalizes the statement", async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      mockGetAllSync.mockReturnValueOnce(rows);
      const driver = await createExpoSqliteDriver();
      const result = await driver.prepare("SELECT * FROM t").all();
      expect(result).toEqual(rows);
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });

  describe("prepare().get()", () => {
    it("returns the first row when present", async () => {
      mockGetFirstSync.mockReturnValueOnce({ id: 1 });
      const driver = await createExpoSqliteDriver();
      const result = await driver.prepare("SELECT * FROM t WHERE id = ?").get(1);
      expect(result).toEqual({ id: 1 });
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });

    it("returns undefined (not null) when no row is found", async () => {
      mockGetFirstSync.mockReturnValueOnce(null);
      const driver = await createExpoSqliteDriver();
      const result = await driver.prepare("SELECT * FROM t WHERE id = ?").get(999);
      expect(result).toBeUndefined();
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });

  describe("statement finalization", () => {
    it("finalizes the statement even when executeSync throws", async () => {
      mockExecuteSync.mockImplementationOnce(() => {
        throw new Error("db error");
      });
      const driver = await createExpoSqliteDriver();
      expect(() => driver.prepare("SELECT 1").run()).toThrow("db error");
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });

  describe("encryption", () => {
    const TEST_KEY_HEX = "a".repeat(64);

    it("applies PRAGMA key when encryptionKeyHex is provided", async () => {
      await createExpoSqliteDriver({ encryptionKeyHex: TEST_KEY_HEX });
      expect(mockExecSync).toHaveBeenCalledWith(`PRAGMA key = "x'${TEST_KEY_HEX}'"`);
    });

    it("does not apply PRAGMA key when no encryption key is provided", async () => {
      await createExpoSqliteDriver();
      expect(mockExecSync).not.toHaveBeenCalledWith(expect.stringContaining("PRAGMA key"));
    });

    it("deletes and recreates DB when encrypted open fails on unencrypted DB", async () => {
      // First execSync (PRAGMA key) succeeds, then SELECT on sqlite_master throws
      // (simulating an unencrypted DB that can't be read with a key)
      let execCallCount = 0;
      mockExecSync.mockImplementation((sql: string) => {
        execCallCount++;
        // Call 1: PRAGMA key on first open - succeeds
        // Call 2: SELECT count(*) from sqlite_master - fails (unencrypted DB)
        if (execCallCount === 2 && sql.includes("sqlite_master")) {
          throw new Error("file is not a database");
        }
        // Call 3+: After delete and reopen, everything succeeds
      });

      await createExpoSqliteDriver({ encryptionKeyHex: TEST_KEY_HEX });

      expect(mockCloseSync).toHaveBeenCalledOnce();
      expect(mockDeleteDatabaseSync).toHaveBeenCalledWith("pluralscape-sync.db");
      // openDatabaseSync called twice: initial open + reopen after delete
      expect(mockOpenDatabaseSync).toHaveBeenCalledTimes(2);
    });

    it("does not delete DB when encrypted open succeeds", async () => {
      await createExpoSqliteDriver({ encryptionKeyHex: TEST_KEY_HEX });
      expect(mockDeleteDatabaseSync).not.toHaveBeenCalled();
      expect(mockCloseSync).not.toHaveBeenCalled();
    });
  });

  describe("encryption constants", () => {
    it("exports KDF context of exactly 8 bytes", () => {
      expect(DB_ENCRYPTION_KDF_CONTEXT).toHaveLength(8);
    });

    it("exports a positive subkey ID", () => {
      expect(DB_ENCRYPTION_SUBKEY_ID).toBeGreaterThan(0);
    });

    it("exports 32-byte key length (256-bit)", () => {
      expect(DB_ENCRYPTION_KEY_BYTES).toBe(32);
    });
  });
});
