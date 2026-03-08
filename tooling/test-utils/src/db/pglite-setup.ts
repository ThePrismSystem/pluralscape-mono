import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { PgliteDatabase } from "drizzle-orm/pglite";

export interface TestDatabase<TSchema extends Record<string, unknown> = Record<string, never>> {
  db: PgliteDatabase<TSchema>;
  client: PGlite;
  teardown: () => Promise<void>;
}

/**
 * Creates an in-memory PGlite instance with a Drizzle client for testing.
 *
 * Call `teardown()` in afterEach/afterAll to clean up.
 */
export async function createTestDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(schema?: TSchema): Promise<TestDatabase<TSchema>> {
  const client = await PGlite.create();
  let db: PgliteDatabase<TSchema>;
  try {
    db = (schema ? drizzle(client, { schema }) : drizzle(client)) as PgliteDatabase<TSchema>;
  } catch (error: unknown) {
    await client.close();
    throw error;
  }

  return {
    db,
    client,
    teardown: async () => {
      await client.close();
    },
  };
}
