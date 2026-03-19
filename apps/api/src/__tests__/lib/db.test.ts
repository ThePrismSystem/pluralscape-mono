import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetDbForTesting, getRawClient, setDbForTesting } from "../../lib/db.js";

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
    // Simulate that a raw client was set via setDbForTesting
    setDbForTesting({} as PostgresJsDatabase);
    _resetDbForTesting();
    expect(getRawClient()).toBeNull();
  });
});
