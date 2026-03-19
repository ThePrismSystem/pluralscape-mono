import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Closeable } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const { mockCreateDatabaseFromEnv } = vi.hoisted(() => ({
  mockCreateDatabaseFromEnv: vi.fn(),
}));

vi.mock("@pluralscape/db", () => ({
  createDatabaseFromEnv: mockCreateDatabaseFromEnv,
}));

const { _resetDbForTesting, getDb, getRawClient, setDbForTesting } =
  await import("../../lib/db.js");

afterEach(() => {
  _resetDbForTesting();
  vi.restoreAllMocks();
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

  it("returns a no-op closeable when setDbForTesting is called without rawClient", () => {
    setDbForTesting({} as PostgresJsDatabase);
    const client = getRawClient();
    expect(client).not.toBeNull();
  });
});

describe("getDb", () => {
  const mockDb = {} as PostgresJsDatabase;
  const mockRawClient: Closeable = { end: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    mockCreateDatabaseFromEnv.mockResolvedValue({
      dialect: "pg" as const,
      db: mockDb,
      rawClient: mockRawClient,
    });
  });

  it("returns the same promise when called concurrently", async () => {
    const p1 = getDb();
    const p2 = getDb();
    expect(p1).toBe(p2);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
    expect(mockCreateDatabaseFromEnv).toHaveBeenCalledOnce();
  });

  it("returns cached db on subsequent calls", async () => {
    await getDb();
    const db = await getDb();
    expect(db).toBe(mockDb);
    expect(mockCreateDatabaseFromEnv).toHaveBeenCalledOnce();
  });

  it("retries after a failure", async () => {
    mockCreateDatabaseFromEnv
      .mockRejectedValueOnce(new Error("connect failed"))
      .mockResolvedValueOnce({ dialect: "pg", db: mockDb, rawClient: mockRawClient });

    await expect(getDb()).rejects.toThrow("connect failed");
    const db = await getDb();
    expect(db).toBe(mockDb);
    expect(mockCreateDatabaseFromEnv).toHaveBeenCalledTimes(2);
  });

  it("throws when dialect is not pg", async () => {
    mockCreateDatabaseFromEnv.mockResolvedValueOnce({ dialect: "sqlite", db: {} });
    await expect(getDb()).rejects.toThrow("API requires PostgreSQL");
  });
});
