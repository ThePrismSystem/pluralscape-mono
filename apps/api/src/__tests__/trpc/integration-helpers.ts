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
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import { asDb, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
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

/** A fully-seeded tenant: account + system + a session AuthContext for it. */
export interface SeededTenant {
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly auth: AuthContext;
}

/**
 * Seed a fresh account + system pair and return a SeededTenant whose
 * AuthContext is suitable for invoking authenticated tRPC procedures.
 *
 * The `as never` cast on `db` mirrors `concurrent-guard-semantics.integration.test.ts`:
 * the pg-helpers functions take `PgliteDatabase<Record<string, unknown>>` but we
 * carry a `PostgresJsDatabase` by the time it reaches a router test. Both are
 * `PgDatabase` subclasses with identical insert APIs.
 */
export async function seedAccountAndSystem(db: PostgresJsDatabase): Promise<SeededTenant> {
  const accountIdRaw = await pgInsertAccount(db as never);
  const systemIdRaw = await pgInsertSystem(db as never, accountIdRaw);
  const accountId = brandId<AccountId>(accountIdRaw);
  const systemId = brandId<SystemId>(systemIdRaw);
  return {
    accountId,
    systemId,
    auth: makeAuth(accountId, systemId),
  };
}

/**
 * Convenience alias for seeding a second tenant in cross-tenant isolation tests.
 * Identical behaviour to `seedAccountAndSystem`; named explicitly to make the
 * intent at the call site clear.
 */
export async function seedSecondTenant(db: PostgresJsDatabase): Promise<SeededTenant> {
  return seedAccountAndSystem(db);
}
