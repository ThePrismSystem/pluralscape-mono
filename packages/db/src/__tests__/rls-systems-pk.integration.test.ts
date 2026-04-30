/**
 * RLS systems-PK tests.
 *
 * Covers: the `systems` table itself, which uses a combined predicate:
 *   PK check (id = current_system_id) AND account ownership
 *   (account_id = current_account_id). This prevents a leaked system ID from
 *   granting access when the account context does not match.
 *
 * Companion files: rls-system-isolation, rls-account-isolation, rls-dual-tenant,
 *   rls-audit-log, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableRls, systemsPkRlsPolicy } from "../rls/policies.js";

import { pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";
import {
  APP_ROLE,
  createAccountsAndSystemsSchema,
  setSessionAccountId,
  setSessionSystemId,
} from "./helpers/rls-test-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// systems — PK with account ownership (db-zy79 / audit H1)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — systems PK with account ownership (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON systems TO ${APP_ROLE}`);

    for (const stmt of enableRls("systems")) {
      await client.query(stmt);
    }
    await client.query(systemsPkRlsPolicy());

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("owner account + matching system can read the system row", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM systems WHERE id = ${systemIdA}`);
    expect(result.rows).toHaveLength(1);
  });

  it("system GUC alone does not unlock another account's system (db-zy79 negative)", async () => {
    // Attacker scenario: session has been populated with systemIdB (say, via
    // a leaked ID) but the account context is accountIdA. Before the fix the
    // policy was `id = current_system_id()` which would return the row; the
    // combined predicate now additionally requires `account_id =
    // current_account_id()`.
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdB);

    const result = await db.execute(sql`SELECT * FROM systems WHERE id = ${systemIdB}`);
    expect(result.rows).toHaveLength(0);
  });

  it("returns empty when either GUC is unset (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM systems`);
    expect(result.rows).toHaveLength(0);

    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdA);

    const result2 = await db.execute(sql`SELECT * FROM systems`);
    expect(result2.rows).toHaveLength(0);
  });

  it("WITH CHECK blocks cross-account UPDATE of account_id", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    // Attempt to reparent systemIdA under accountIdB — must fail the WITH CHECK.
    // Use client.query (not db.execute) so the RLS error surfaces unwrapped;
    // Drizzle wraps the inner error in a generic "Failed query: ..." message
    // which would defeat the tightened matcher below.
    await expect(
      client.query(`UPDATE systems SET account_id = $1 WHERE id = $2`, [accountIdB, systemIdA]),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });
});
