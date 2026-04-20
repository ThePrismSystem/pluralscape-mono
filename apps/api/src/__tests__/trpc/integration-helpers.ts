/**
 * Shared infrastructure for tRPC router integration tests.
 *
 * Used by all router files in `routers/*.integration.test.ts`. This is the
 * single source of truth for:
 *  - PGlite setup and teardown
 *  - Tenant seeding (account + system)
 *  - Entity seed helpers used by 3+ router files
 *  - Assertion helpers for auth and tenant errors
 *
 * Helpers used by only 1 router live inside that router's test file.
 * If a router-local helper turns out to be needed by another router,
 * promote it here — but not before.
 */
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import { createPgAllTables } from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";

import { asDb } from "../helpers/integration-setup.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface RouterIntegrationCtx {
  readonly db: PostgresJsDatabase;
  readonly pglite: PGlite;
  readonly teardown: () => Promise<void>;
}

export async function setupRouterIntegration(): Promise<RouterIntegrationCtx> {
  const pglite = new PGlite();
  await createPgAllTables(pglite);
  const pgliteDb: PgliteDatabase<typeof schema> = drizzle(pglite, { schema });
  return {
    db: asDb(pgliteDb),
    pglite,
    teardown: async () => {
      await pglite.close();
    },
  };
}
