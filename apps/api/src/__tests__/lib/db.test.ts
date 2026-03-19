import { afterEach, describe, expect, it, vi } from "vitest";

import type { Closeable } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const { mockCreateDatabaseFromEnv } = vi.hoisted(() => ({
  mockCreateDatabaseFromEnv: vi.fn(),
}));

vi.mock("@pluralscape/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@pluralscape/db")>();
  return {
    ...original,
    createDatabaseFromEnv: mockCreateDatabaseFromEnv,
  };
});

// Dynamic import after mocks are set up
const { getDb, getRawClient, setDbForTesting, _resetDbForTesting } =
  await import("../../lib/db.js");

afterEach(() => {
  _resetDbForTesting();
  mockCreateDatabaseFromEnv.mockReset();
});

describe("getRawClient", () => {
  it("returns null before getDb() has been called", () => {
    expect(getRawClient()).toBeNull();
  });

  it("returns null after _resetDbForTesting()", () => {
    setDbForTesting({} as PostgresJsDatabase);
    _resetDbForTesting();
    expect(getRawClient()).toBeNull();
  });

  it("returns the rawClient passed to setDbForTesting", () => {
    const mockRawClient: Closeable = { end: vi.fn().mockResolvedValue(undefined) };
    setDbForTesting({} as PostgresJsDatabase, mockRawClient);
    expect(getRawClient()).toBe(mockRawClient);
  });

  it("returns null when setDbForTesting is called without rawClient", () => {
    setDbForTesting({} as PostgresJsDatabase);
    expect(getRawClient()).toBeNull();
  });
});

describe("getDb", () => {
  it("concurrent calls deduplicate (factory called once)", async () => {
    const mockDb = {} as PostgresJsDatabase;
    const mockRawClient: Closeable = { end: vi.fn() };
    mockCreateDatabaseFromEnv.mockResolvedValue({
      dialect: "pg",
      db: mockDb,
      rawClient: mockRawClient,
    });

    const [db1, db2] = await Promise.all([getDb(), getDb()]);

    expect(db1).toBe(mockDb);
    expect(db2).toBe(mockDb);
    expect(mockCreateDatabaseFromEnv).toHaveBeenCalledOnce();
  });

  it("after failure, pendingInit is reset and retry succeeds", async () => {
    mockCreateDatabaseFromEnv.mockRejectedValueOnce(new Error("connect failed"));

    await expect(getDb()).rejects.toThrow("connect failed");

    const mockDb = {} as PostgresJsDatabase;
    const mockRawClient: Closeable = { end: vi.fn() };
    mockCreateDatabaseFromEnv.mockResolvedValue({
      dialect: "pg",
      db: mockDb,
      rawClient: mockRawClient,
    });

    const db = await getDb();
    expect(db).toBe(mockDb);
    expect(mockCreateDatabaseFromEnv).toHaveBeenCalledTimes(2);
  });
});
