import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock expo-sqlite since it's not available in vitest
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
const mockWithTransactionSync = vi.fn((fn: () => void) => {
  fn();
});
const mockCloseSync = vi.fn();

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({
    prepareSync: mockPrepareSync,
    execSync: mockExecSync,
    withTransactionSync: mockWithTransactionSync,
    closeSync: mockCloseSync,
  })),
}));

import { createExpoSqliteDriver } from "../expo-sqlite-driver.js";

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
      driver.exec("CREATE TABLE t (id INTEGER)");
      expect(mockExecSync).toHaveBeenCalledWith("CREATE TABLE t (id INTEGER)");
    });
  });

  describe("close()", () => {
    it("delegates to db.closeSync()", async () => {
      const driver = await createExpoSqliteDriver();
      driver.close();
      expect(mockCloseSync).toHaveBeenCalledOnce();
    });
  });

  describe("transaction()", () => {
    it("wraps fn in db.withTransactionSync() and returns fn result", async () => {
      const driver = await createExpoSqliteDriver();
      const result = driver.transaction(() => 42);
      expect(mockWithTransactionSync).toHaveBeenCalled();
      expect(result).toBe(42);
    });
  });

  describe("prepare().run()", () => {
    it("prepares, executes, and finalizes the statement", async () => {
      const driver = await createExpoSqliteDriver();
      driver.prepare("INSERT INTO t VALUES (?)").run(1);
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
      const result = driver.prepare("SELECT * FROM t").all();
      expect(result).toEqual(rows);
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });

  describe("prepare().get()", () => {
    it("returns the first row when present", async () => {
      mockGetFirstSync.mockReturnValueOnce({ id: 1 });
      const driver = await createExpoSqliteDriver();
      const result = driver.prepare("SELECT * FROM t WHERE id = ?").get(1);
      expect(result).toEqual({ id: 1 });
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });

    it("returns undefined (not null) when no row is found", async () => {
      mockGetFirstSync.mockReturnValueOnce(null);
      const driver = await createExpoSqliteDriver();
      const result = driver.prepare("SELECT * FROM t WHERE id = ?").get(999);
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
      expect(() => {
        driver.prepare("SELECT 1").run();
      }).toThrow("db error");
      expect(mockFinalizeSync).toHaveBeenCalledOnce();
    });
  });
});
