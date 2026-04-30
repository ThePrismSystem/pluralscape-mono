import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableRls, systemRlsPolicy } from "../rls/policies.js";

import { pgInsertAccount, pgInsertMember, pgInsertSystem } from "./helpers/pg-helpers.js";
import {
  APP_ROLE,
  clearSessionContext,
  createAccountsAndSystemsSchema,
  setSessionSystemId,
} from "./helpers/rls-test-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Lock-in regression trap for RLS fail-silent behavior.
 *
 * RLS policies evaluate against
 * NULLIF(current_setting('app.current_system_id', true), '')::varchar.
 * With no context set the policy is false for every row and the query returns
 * []. This test documents that behavior as a regression trap — if a future
 * policy change accidentally returned rows for un-contexted queries, this test
 * would fail immediately.
 *
 * The wrapper helpers in apps/api/src/lib/rls-context.ts ensure the GUC is
 * set for every legitimate query; the ESLint rule in apps/api/eslint.config.js
 * forbidding bare db.execute / db.transaction outside the wrappers is the
 * other half of this defense.
 */
describe("RLS unset-context fail-silent behavior", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    // Shared accounts + systems DDL via helper. Members DDL is inline because it
    // is unique to this test (UNIQUE (id, system_id) constraint not used elsewhere).
    await createAccountsAndSystemsSchema(client);
    await client.query(`
      CREATE TABLE members (
        id VARCHAR(255) PRIMARY KEY,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        encrypted_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ,
        UNIQUE (id, system_id)
      )
    `);

    // Seed one account, system, and member with context set.
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);

    await setSessionSystemId(db, systemId);
    await pgInsertMember(db, systemId);

    // Create role and grant table access before enabling RLS.
    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON systems TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON members TO ${APP_ROLE}`);

    // Apply RLS using the same generators as rls-policies.integration.test.ts.
    for (const stmt of enableRls("members")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("members"));

    // Switch to the app role so RLS policies are enforced.
    await client.query(`SET ROLE ${APP_ROLE}`);

    // Clear context before test body — this is the state under test.
    await clearSessionContext(db);
  });

  afterAll(async () => {
    await client.close();
  });

  it("GUC is empty string when context is unset", async () => {
    const result = await db.execute<{ setting: string }>(sql`
      SELECT current_setting('app.current_system_id', true) AS setting
    `);
    const rows = Array.isArray(result) ? result : (result.rows as Array<{ setting: string }>);
    const setting = rows[0]?.setting;
    // PGlite returns null for missing GUC with true (missing_ok) — or empty string
    // when explicitly set to ''. Either satisfies the fail-closed predicate.
    expect(setting === null || setting === "" || setting === undefined).toBe(true);
  });

  it("returns 0 rows from members when context is unset", async () => {
    await clearSessionContext(db);

    const result = await db.execute<{ id: string }>(sql`SELECT id FROM members LIMIT 10`);
    const rows = Array.isArray(result) ? result : (result.rows as Array<{ id: string }>);

    // Fail-silent: RLS policy is false for all rows when system_id GUC is empty.
    // If this assertion ever fails, a policy change has accidentally disabled
    // the fail-closed guarantee — investigate immediately.
    expect(rows).toHaveLength(0);
  });

  it("still returns 0 rows after context is explicitly reset to empty string", async () => {
    // Belt-and-suspenders: confirm the empty-string path is equivalent to unset.
    await clearSessionContext(db);

    const result = await db.execute<{ id: string }>(sql`SELECT id FROM members LIMIT 10`);
    const rows = Array.isArray(result) ? result : (result.rows as Array<{ id: string }>);
    expect(rows).toHaveLength(0);
  });
});
