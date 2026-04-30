/**
 * RLS audit-log tests.
 *
 * Covers: `audit_log` NULL-aware dual-tenant scope (db-dpp7 / audit C1).
 *   - After ON DELETE SET NULL the row remains on disk but tenant columns
 *     become NULL. Regular account/system context MUST NOT match those rows.
 *   - A dedicated forensic role with BYPASSRLS can retrieve them.
 *   - WITH CHECK blocks cross-tenant INSERT and asymmetric NULL INSERT.
 *
 * Companion files: rls-system-isolation, rls-account-isolation, rls-dual-tenant,
 *   rls-systems-pk, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLogRlsPolicy, enableRls } from "../rls/policies.js";

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
// audit_log — NULL-aware dual-tenant scope
// ---------------------------------------------------------------------------

describe("RLS audit_log NULL-aware tenant isolation (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const liveEntryId = crypto.randomUUID();
  const nulledEntryId = crypto.randomUUID();
  const crossTenantEntryId = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);
    // Minimal audit_log table (matches the ON DELETE SET NULL behavior from
    // the production schema — no PARTITION clause so PGlite is happy).
    await client.query(`
      CREATE TABLE audit_log (
        id VARCHAR(255) NOT NULL,
        account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE SET NULL,
        system_id VARCHAR(255) REFERENCES systems(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL,
        actor JSONB NOT NULL,
        PRIMARY KEY (id, "timestamp")
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO audit_log (id, account_id, system_id, event_type, "timestamp", actor)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        liveEntryId,
        accountIdA,
        systemIdA,
        "auth.login",
        now,
        `{"kind":"account","id":"${accountIdA}"}`,
      ],
    );
    await client.query(
      `INSERT INTO audit_log (id, account_id, system_id, event_type, "timestamp", actor)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crossTenantEntryId,
        accountIdB,
        systemIdB,
        "auth.login",
        now,
        `{"kind":"account","id":"${accountIdB}"}`,
      ],
    );
    await client.query(
      `INSERT INTO audit_log (id, account_id, system_id, event_type, "timestamp", actor)
       VALUES ($1, NULL, NULL, $2, $3, $4)`,
      [nulledEntryId, "account.purge", now, `{"kind":"system","id":"purge"}`],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON audit_log TO ${APP_ROLE}`);
    // Dedicated forensic role that bypasses RLS. The "rows still present on
    // disk" test below uses this role in place of implicit superuser reads via
    // RESET ROLE — future tightening of superuser behavior should not perturb
    // this assertion, because the operational intent (a privileged read path
    // for purge forensics) is expressed directly.
    await client.query(`CREATE ROLE audit_reader BYPASSRLS`);
    await client.query(`GRANT SELECT ON audit_log TO audit_reader`);

    for (const stmt of enableRls("audit_log")) {
      await client.query(stmt);
    }
    await client.query(auditLogRlsPolicy());

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("tenant can read its own live audit rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT id FROM audit_log`);
    const ids = result.rows.map((r) => (r as { id: string }).id);
    expect(ids).toContain(liveEntryId);
    expect(ids).not.toContain(crossTenantEntryId);
  });

  it("rows with NULL tenant references remain invisible through regular tenant context (db-dpp7)", async () => {
    // After ON DELETE SET NULL the row still exists in the table but its
    // tenant columns are NULL. Regular account/system context MUST NOT match.
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT id FROM audit_log WHERE id = ${nulledEntryId}`);
    expect(result.rows).toHaveLength(0);
  });

  it("rows with NULL tenant references remain present on disk (not deleted)", async () => {
    // Sanity check: the row still exists; it just cannot be read through the
    // standard tenant-isolation policy. A dedicated forensic role with
    // BYPASSRLS can retrieve it — we exercise that role explicitly rather
    // than relying on implicit superuser behavior.
    try {
      await client.query(`SET ROLE audit_reader`);
      const forensic = await client.query<{ id: string }>(
        `SELECT id FROM audit_log WHERE id = $1`,
        [nulledEntryId],
      );
      expect(forensic.rows.map((r) => r.id)).toContain(nulledEntryId);
    } finally {
      await client.query(`SET ROLE ${APP_ROLE}`);
    }
  });

  it("cross-tenant audit rows remain invisible", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT id FROM audit_log WHERE id = ${crossTenantEntryId}`);
    expect(result.rows).toHaveLength(0);
  });

  it("fail-closed when no tenant context is set", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT id FROM audit_log`);
    expect(result.rows).toHaveLength(0);
  });

  it("WITH CHECK blocks cross-tenant INSERT", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await expect(
      client.query(
        `INSERT INTO audit_log (id, account_id, system_id, event_type, "timestamp", actor)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          accountIdB,
          systemIdB,
          "auth.login",
          new Date().toISOString(),
          `{"kind":"account","id":"${accountIdB}"}`,
        ],
      ),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it("asymmetric NULL INSERT is blocked by IS NOT NULL WITH CHECK guard", async () => {
    // Even with full tenant context, a write that sets system_id = NULL must
    // fail the symmetric WITH CHECK. Application code never writes NULL — only
    // ON DELETE SET NULL cascades do — so this is the defensive guard
    // catching any future regression.
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await expect(
      client.query(
        `INSERT INTO audit_log (id, account_id, system_id, event_type, "timestamp", actor)
         VALUES ($1, $2, NULL, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          accountIdA,
          "auth.login",
          new Date().toISOString(),
          `{"kind":"account","id":"${accountIdA}"}`,
        ],
      ),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });
});
