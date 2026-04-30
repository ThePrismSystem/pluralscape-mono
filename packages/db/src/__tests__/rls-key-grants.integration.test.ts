/**
 * RLS key-grants tests.
 *
 * Covers: `key_grants` asymmetric read/write policy.
 *   - Owner read: rows visible when system_id matches current_system_id (issuer path).
 *   - Friend read: rows visible when friend_account_id matches current_account_id
 *     (recipient path) — WITHOUT requiring the originating system context.
 *   - Write (INSERT/UPDATE/DELETE) restricted to the issuing system; friends
 *     have SELECT-only access and cannot mutate grants addressed to them.
 *   - Independence: the two read paths do not leak across sibling systems.
 *
 * Companion files: rls-system-isolation, rls-account-isolation, rls-dual-tenant,
 *   rls-systems-pk, rls-audit-log, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableRls, keyGrantsRlsPolicy, systemRlsPolicy } from "../rls/policies.js";

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
// key_grants — asymmetric owner/friend read, write restricted to issuer
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — key_grants (system scope, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const bucketIdA = crypto.randomUUID();
  const bucketIdB = crypto.randomUUID();
  const grantIdA = crypto.randomUUID();
  const grantIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);
    await client.query(`
      CREATE TABLE buckets (
        id VARCHAR(255) PRIMARY KEY,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        encrypted_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
    await client.query(`
      CREATE TABLE key_grants (
        id VARCHAR(255) PRIMARY KEY,
        bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        friend_account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_key BYTEA NOT NULL,
        key_version INTEGER NOT NULL CHECK (key_version >= 1),
        created_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [bucketIdA, systemIdA, new Uint8Array([1]), now, now],
    );
    await client.query(
      `INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [bucketIdB, systemIdB, new Uint8Array([2]), now, now],
    );
    await client.query(
      `INSERT INTO key_grants (id, bucket_id, system_id, friend_account_id, encrypted_key, key_version, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [grantIdA, bucketIdA, systemIdA, accountIdA, new Uint8Array([10]), 1, now],
    );
    await client.query(
      `INSERT INTO key_grants (id, bucket_id, system_id, friend_account_id, encrypted_key, key_version, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [grantIdB, bucketIdB, systemIdB, accountIdB, new Uint8Array([20]), 1, now],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON buckets TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON key_grants TO ${APP_ROLE}`);

    // RLS on buckets (system scope — parent table)
    for (const stmt of enableRls("buckets")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("buckets"));

    // RLS on key_grants — dual-path (owner via system_id + friend via account_id)
    for (const stmt of enableRls("key_grants")) {
      await client.query(stmt);
    }
    for (const policy of keyGrantsRlsPolicy()) {
      await client.query(policy);
    }

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees key_grants for correct tenant", async () => {
    await setSessionSystemId(db, systemIdA);
    // Also set an account context that is not the friend on either grant so we
    // exercise the owner-read path exclusively.
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM key_grants`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(grantIdA);
  });

  it("returns empty when no system/account context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM key_grants`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant key_grants not visible to non-recipient", async () => {
    await setSessionSystemId(db, systemIdA);
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM key_grants WHERE id = ${grantIdB}`);
    expect(result.rows).toHaveLength(0);
  });

  it("friend can read grants addressed to them without originating system context", async () => {
    // accountIdB is the friend_account_id on grantIdB (the grant issued by
    // systemIdB). Set the friend's account context but NOT systemIdB — the
    // friend does not know or control the originating system's ID. The
    // friend-side read policy must still return the row.
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdB);

    const result = await db.execute(sql`SELECT * FROM key_grants WHERE id = ${grantIdB}`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(grantIdB);
  });

  it("friend cannot read grants addressed to other accounts", async () => {
    // accountIdA is not a friend on grantIdB — they must not see it through
    // the friend-side read policy.
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM key_grants WHERE id = ${grantIdB}`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant INSERT blocked", async () => {
    await setSessionSystemId(db, systemIdA);
    await setSessionAccountId(db, accountIdA);

    await expect(
      client.query(
        `INSERT INTO key_grants (id, bucket_id, system_id, friend_account_id, encrypted_key, key_version, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          crypto.randomUUID(),
          bucketIdB,
          systemIdB,
          systemIdA,
          new Uint8Array([99]),
          1,
          new Date().toISOString(),
        ],
      ),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it("friend-read cannot bypass write restriction (INSERT blocked without system context)", async () => {
    // A friend-only account must not be able to INSERT a grant — writes must
    // come from the originating system.
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdB);

    await expect(
      client.query(
        `INSERT INTO key_grants (id, bucket_id, system_id, friend_account_id, encrypted_key, key_version, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          crypto.randomUUID(),
          bucketIdA,
          systemIdA,
          accountIdB,
          new Uint8Array([99]),
          1,
          new Date().toISOString(),
        ],
      ),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it("friend cannot UPDATE grant addressed to them", async () => {
    // accountIdB is the friend on grantIdB but has no system GUC set. The
    // owner-path UPDATE USING clause requires system_id = current_system_id()
    // and the friend-read policy is SELECT-only, so UPDATE affects 0 rows
    // (RLS silently hides rows whose write policy does not match).
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdB);

    await client.query(`UPDATE key_grants SET revoked_at = $1 WHERE id = $2`, [
      new Date().toISOString(),
      grantIdB,
    ]);

    // Verify nothing was mutated — read back through the owning system.
    await setSessionSystemId(db, systemIdB);
    await setSessionAccountId(db, accountIdB);
    const result = await client.query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM key_grants WHERE id = $1`,
      [grantIdB],
    );
    expect(result.rows[0]?.revoked_at).toBeNull();
  });

  it("friend cannot DELETE grant addressed to them", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);
    await setSessionAccountId(db, accountIdB);

    await client.query(`DELETE FROM key_grants WHERE id = $1`, [grantIdB]);

    await setSessionSystemId(db, systemIdB);
    await setSessionAccountId(db, accountIdB);
    const result = await client.query<{ id: string }>(`SELECT id FROM key_grants WHERE id = $1`, [
      grantIdB,
    ]);
    expect(result.rows.map((r) => r.id)).toContain(grantIdB);
  });

  it("cross-tenant UPDATE affects 0 rows", async () => {
    // systemA context attempts to revoke grantIdB (owned by systemB). Owner-
    // path USING fails and friend-read is SELECT-only, so the UPDATE is a
    // no-op (RLS silently filters out rows the caller cannot modify).
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await client.query(`UPDATE key_grants SET revoked_at = $1 WHERE id = $2`, [
      new Date().toISOString(),
      grantIdB,
    ]);

    await setSessionSystemId(db, systemIdB);
    await setSessionAccountId(db, accountIdB);
    const result = await client.query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM key_grants WHERE id = $1`,
      [grantIdB],
    );
    expect(result.rows[0]?.revoked_at).toBeNull();
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await client.query(`DELETE FROM key_grants WHERE id = $1`, [grantIdB]);

    await setSessionSystemId(db, systemIdB);
    await setSessionAccountId(db, accountIdB);
    const result = await client.query<{ id: string }>(`SELECT id FROM key_grants WHERE id = $1`, [
      grantIdB,
    ]);
    expect(result.rows.map((r) => r.id)).toContain(grantIdB);
  });

  it("owner_read and friend_read are independently scoped across multiple systems for the same account", async () => {
    // accountIdA owns systemIdA AND a second system (systemIdA2). grantIdA's
    // friend_account_id is accountIdA, system_id is systemIdA. Test three
    // contexts to confirm the two read paths are wired independently:
    //
    //   1. systemIdA2 GUC + accountIdA GUC:
    //      - owner_read fails (system_id ≠ current_system_id)
    //      - friend_read matches (friend_account_id = current_account_id)
    //      → row visible, exclusively via friend_read.
    //   2. systemIdA2 GUC, account GUC cleared:
    //      - owner_read fails, friend_read fails (account unset)
    //      → row NOT visible, proving owner_read does not leak across
    //        sibling systems owned by the same account.
    //   3. systemIdA GUC (owner side), account GUC cleared:
    //      - owner_read matches, friend_read fails (account unset)
    //      → row visible, exclusively via owner_read.
    const systemIdA2 = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    // Seed the second system via raw SQL under the owning superuser — the
    // APP_ROLE lacks GRANT on `systems` in this suite (only buckets and
    // key_grants are exposed), so pgInsertSystem would fail permission checks.
    try {
      await client.query(`RESET ROLE`);
      await client.query(
        `INSERT INTO systems (id, account_id, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
        [systemIdA2, accountIdA, nowIso, nowIso],
      );
    } finally {
      await client.query(`SET ROLE ${APP_ROLE}`);
    }

    // 1. Sibling-system GUC + friend account → visible only via friend_read.
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA2);
    const friendOnly = await db.execute(sql`SELECT id FROM key_grants WHERE id = ${grantIdA}`);
    expect(friendOnly.rows).toHaveLength(1);

    // 2. Sibling-system GUC + account cleared → neither path matches.
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    const neither = await db.execute(sql`SELECT id FROM key_grants WHERE id = ${grantIdA}`);
    expect(neither.rows).toHaveLength(0);

    // 3. Owning-system GUC + account cleared → visible only via owner_read.
    await setSessionSystemId(db, systemIdA);
    const ownerOnly = await db.execute(sql`SELECT id FROM key_grants WHERE id = ${grantIdA}`);
    expect(ownerOnly.rows).toHaveLength(1);
  });
});
