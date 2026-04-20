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

/** Row shape returned by `pg_tables` for table discovery. */
interface PgTablesRow {
  readonly tablename: string;
}

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

/**
 * Truncate every table in the public schema with RESTART IDENTITY CASCADE.
 * Designed for `afterEach` between tests in a single file. Discovers tables
 * dynamically via the underlying PGlite handle so future schema additions
 * don't require updating this list.
 *
 * Takes the `RouterIntegrationCtx` rather than a bare `PostgresJsDatabase`
 * so we can use the typed PGlite query API for the discovery SELECT — the
 * postgres.js `db.execute()` `RowList` shape isn't usable without a cast.
 */
export async function truncateAll(ctx: RouterIntegrationCtx): Promise<void> {
  const result = await ctx.pglite.query<PgTablesRow>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tables = result.rows
    .map((r) => r.tablename)
    .filter((t) => t !== "drizzle_migrations" && !t.startsWith("_"));
  if (tables.length === 0) return;
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await ctx.pglite.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
}
