import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetDbForTesting, getRawClient, setDbForTesting } from "../../lib/db.js";

import type { Closeable } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

afterEach(() => {
  _resetDbForTesting();
  vi.restoreAllMocks();
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
