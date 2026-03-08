import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { PgliteDatabase } from "drizzle-orm/pglite";

interface TestDatabase {
  db: PgliteDatabase;
  client: PGlite;
  teardown: () => Promise<void>;
}

/**
 * Creates an in-memory PGlite instance with a Drizzle client for testing.
 * Uses schema push (not migrations) for speed.
 *
 * Call `teardown()` in afterEach/afterAll to clean up.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = await PGlite.create();
  const db = drizzle(client);

  return {
    db,
    client,
    teardown: async () => {
      await client.close();
    },
  };
}
