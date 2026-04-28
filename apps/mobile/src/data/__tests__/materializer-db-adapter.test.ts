import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import {
  createMaterializerDbAdapter,
  type ExecuteSyncResult,
  type SqliteStatementHandle,
  type SqliteSyncDatabase,
} from "../materializer-db-adapter.js";

interface TestRow {
  readonly id: string;
}

function setupMocks(rows: TestRow[]): {
  db: MockProxy<SqliteSyncDatabase>;
  stmt: MockProxy<SqliteStatementHandle>;
  result: MockProxy<ExecuteSyncResult<TestRow>>;
} {
  const result = mock<ExecuteSyncResult<TestRow>>();
  result.getAllSync.mockReturnValue(rows);

  const stmt = mock<SqliteStatementHandle>();
  stmt.executeSync.mockReturnValue(result);

  const db = mock<SqliteSyncDatabase>();
  db.prepareSync.mockReturnValue(stmt);
  db.withTransactionSync.mockImplementation((fn: () => void) => {
    fn();
  });

  return { db, stmt, result };
}

describe("createMaterializerDbAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queryAll prepares the SQL, executes with params, and returns rows", () => {
    const rows: TestRow[] = [{ id: "m1" }, { id: "m2" }];
    const { db, stmt, result } = setupMocks(rows);
    const adapter = createMaterializerDbAdapter(db);

    const returned = adapter.queryAll<TestRow>("SELECT id FROM members WHERE id = ?", ["m1"]);

    expect(db.prepareSync).toHaveBeenCalledWith("SELECT id FROM members WHERE id = ?");
    expect(stmt.executeSync).toHaveBeenCalledWith(["m1"]);
    expect(stmt.finalizeSync).toHaveBeenCalledTimes(1);
    expect(result.getAllSync).toHaveBeenCalledTimes(1);
    expect(returned).toEqual(rows);
  });

  it("execute prepares the SQL, executes with params, and finalises the statement", () => {
    const { db, stmt } = setupMocks([]);
    const adapter = createMaterializerDbAdapter(db);

    adapter.execute("INSERT INTO members (id) VALUES (?)", ["m_1"]);

    expect(db.prepareSync).toHaveBeenCalledWith("INSERT INTO members (id) VALUES (?)");
    expect(stmt.executeSync).toHaveBeenCalledWith(["m_1"]);
    expect(stmt.finalizeSync).toHaveBeenCalledTimes(1);
  });

  it("finalises the statement even when executeSync throws on execute", () => {
    const { db, stmt } = setupMocks([]);
    stmt.executeSync.mockImplementation(() => {
      throw new Error("boom");
    });
    const adapter = createMaterializerDbAdapter(db);

    expect(() => {
      adapter.execute("INSERT INTO members (id) VALUES (?)", ["m_1"]);
    }).toThrow("boom");
    expect(stmt.finalizeSync).toHaveBeenCalledTimes(1);
  });

  it("finalises the statement even when executeSync throws on queryAll", () => {
    const { db, stmt } = setupMocks([]);
    stmt.executeSync.mockImplementation(() => {
      throw new Error("query-boom");
    });
    const adapter = createMaterializerDbAdapter(db);

    expect(() => {
      adapter.queryAll<TestRow>("SELECT id FROM members WHERE id = ?", ["m1"]);
    }).toThrow("query-boom");
    expect(stmt.finalizeSync).toHaveBeenCalledTimes(1);
  });

  it("transaction wraps the callback in withTransactionSync and propagates the return value", () => {
    const { db } = setupMocks([]);
    const adapter = createMaterializerDbAdapter(db);

    const value = adapter.transaction(() => 42);

    expect(db.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(value).toBe(42);
  });

  it("transaction propagates errors thrown inside the callback", () => {
    const { db } = setupMocks([]);
    const adapter = createMaterializerDbAdapter(db);

    expect(() =>
      adapter.transaction(() => {
        throw new Error("tx-boom");
      }),
    ).toThrow("tx-boom");
    expect(db.withTransactionSync).toHaveBeenCalledTimes(1);
  });
});
