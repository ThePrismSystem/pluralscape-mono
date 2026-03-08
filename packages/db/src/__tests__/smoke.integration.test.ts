import { createTestDatabase } from "@pluralscape/test-utils/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TestDatabase } from "@pluralscape/test-utils/db";

describe("PGlite smoke test", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  it("connects and executes a query", async () => {
    const result = await testDb.client.query<{ result: number }>("SELECT 1 AS result");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.result).toBe(1);
  });

  it("exposes a drizzle client", () => {
    expect(testDb.db).toBeDefined();
  });
});
