/**
 * RLS system-isolation tests.
 *
 * Covers: tables where system_id is the sole tenant boundary.
 *   - members (system-scoped direct FK)
 *   - nomenclature_settings (system_id PK, system-scoped)
 *   - bucket_rotation_items (system-scoped direct FK)
 *
 * Sync FK tables (system-fk scope via FK join to sync_documents) live in
 * rls-system-fk.integration.test.ts to keep each file under 500 LOC.
 *
 * Companion files: rls-system-fk, rls-account-isolation, rls-dual-tenant,
 *   rls-systems-pk, rls-audit-log, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableRls, systemRlsPolicy } from "../rls/policies.js";
import { members } from "../schema/pg/members.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { pgInsertAccount, pgInsertMember, pgInsertSystem, testBlob } from "./helpers/pg-helpers.js";
import {
  APP_ROLE,
  createAccountsAndSystemsSchema,
  setSessionSystemId,
} from "./helpers/rls-test-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { AccountId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// 1. members — system-scoped (direct system_id FK)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const memberIdA1 = brandId<MemberId>(crypto.randomUUID());
  const memberIdA2 = brandId<MemberId>(crypto.randomUUID());
  const memberIdB1 = brandId<MemberId>(crypto.randomUUID());

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await client.query(`
      CREATE TABLE accounts (
        id VARCHAR(255) PRIMARY KEY,
        email_hash VARCHAR(255) NOT NULL UNIQUE,
        email_salt VARCHAR(255) NOT NULL,
        auth_key_hash BYTEA NOT NULL,
        kdf_salt VARCHAR(255),
        encrypted_master_key BYTEA,
        challenge_nonce BYTEA,
        challenge_expires_at TIMESTAMPTZ,
        encrypted_email BYTEA,
        account_type VARCHAR(50) NOT NULL DEFAULT 'system',
        audit_log_ip_tracking BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
    await client.query(`
      CREATE TABLE systems (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_data BYTEA,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ
      )
    `);
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

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);
    await pgInsertMember(db, systemIdA, memberIdA1);
    await pgInsertMember(db, systemIdA, memberIdA2);
    await pgInsertMember(db, systemIdB, memberIdB1);

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON systems TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON members TO ${APP_ROLE}`);

    for (const stmt of enableRls("members")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("members"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees rows for current system", async () => {
    await setSessionSystemId(db, systemIdA);

    const rows = await db.select().from(members);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.systemId).toBe(systemIdA);
    }
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(memberIdA1);
    expect(ids).toContain(memberIdA2);
    expect(ids).not.toContain(memberIdB1);
  });

  it("returns empty when context set to non-existent system (fail-closed)", async () => {
    await setSessionSystemId(db, crypto.randomUUID());

    const rows = await db.select().from(members);

    expect(rows).toHaveLength(0);
  });

  it("returns empty when session variable was never set (true fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const rows = await db.select().from(members);

    expect(rows).toHaveLength(0);
  });

  it("WITH CHECK prevents cross-tenant INSERT", async () => {
    await setSessionSystemId(db, systemIdA);

    const crossTenantId = brandId<MemberId>(crypto.randomUUID());
    const now = fixtureNow();

    await expect(
      db.insert(members).values({
        id: crossTenantId,
        systemId: systemIdB,
        encryptedData: testBlob(new Uint8Array([9, 9, 9])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("cross-tenant UPDATE affects 0 rows", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db
      .update(members)
      .set({ encryptedData: testBlob(new Uint8Array([99, 99])) })
      .where(eq(members.id, memberIdB1));

    expect(result.rows).toHaveLength(0);

    await setSessionSystemId(db, systemIdB);
    const rows = await db.select().from(members).where(eq(members.id, memberIdB1));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(memberIdB1);
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionSystemId(db, systemIdA);

    await db.delete(members).where(eq(members.id, memberIdB1));

    await setSessionSystemId(db, systemIdB);
    const rows = await db.select().from(members).where(eq(members.id, memberIdB1));
    expect(rows).toHaveLength(1);
  });

  it("changing context switches visible rows", async () => {
    await setSessionSystemId(db, systemIdA);
    const rowsA = await db.select().from(members);
    expect(rowsA).toHaveLength(2);
    for (const row of rowsA) {
      expect(row.systemId).toBe(systemIdA);
    }

    await setSessionSystemId(db, systemIdB);
    const rowsB = await db.select().from(members);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]?.systemId).toBe(systemIdB);
    expect(rowsB[0]?.id).toBe(memberIdB1);
  });
});

// ---------------------------------------------------------------------------
// 2. nomenclature_settings — system-pk scope (system_id is the PK)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system-pk scope (PGlite)", () => {
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
    await client.query(`
      CREATE TABLE nomenclature_settings (
        system_id VARCHAR(255) PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
        encrypted_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO nomenclature_settings (system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
      [systemIdA, new Uint8Array([1]), now, now],
    );
    await client.query(
      `INSERT INTO nomenclature_settings (system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
      [systemIdB, new Uint8Array([2]), now, now],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON nomenclature_settings TO ${APP_ROLE}`);

    for (const stmt of enableRls("nomenclature_settings")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("nomenclature_settings"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees nomenclature_settings for current system", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM nomenclature_settings`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["system_id"]).toBe(systemIdA);
  });

  it("returns empty when no system context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM nomenclature_settings`);
    expect(result.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. bucket_rotation_items — system-scoped (direct system_id)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — bucket_rotation_items (system scope, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const bucketIdA = crypto.randomUUID();
  const bucketIdB = crypto.randomUUID();
  const rotationIdA = crypto.randomUUID();
  const rotationIdB = crypto.randomUUID();
  const itemIdA = crypto.randomUUID();
  const itemIdB = crypto.randomUUID();

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
      CREATE TABLE bucket_key_rotations (
        id VARCHAR(255) PRIMARY KEY,
        bucket_id VARCHAR(255) NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        from_key_version INTEGER NOT NULL,
        to_key_version INTEGER NOT NULL,
        state VARCHAR(50) NOT NULL DEFAULT 'initiated',
        initiated_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        total_items INTEGER NOT NULL,
        completed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE TABLE bucket_rotation_items (
        id VARCHAR(255) PRIMARY KEY,
        rotation_id VARCHAR(255) NOT NULL REFERENCES bucket_key_rotations(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        claimed_by VARCHAR(255),
        claimed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        attempts INTEGER NOT NULL DEFAULT 0
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
      `INSERT INTO bucket_key_rotations (id, bucket_id, system_id, from_key_version, to_key_version, state, initiated_at, total_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rotationIdA, bucketIdA, systemIdA, 1, 2, "initiated", now, 1],
    );
    await client.query(
      `INSERT INTO bucket_key_rotations (id, bucket_id, system_id, from_key_version, to_key_version, state, initiated_at, total_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rotationIdB, bucketIdB, systemIdB, 1, 2, "initiated", now, 1],
    );
    await client.query(
      `INSERT INTO bucket_rotation_items (id, rotation_id, system_id, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)`,
      [itemIdA, rotationIdA, systemIdA, "member", crypto.randomUUID()],
    );
    await client.query(
      `INSERT INTO bucket_rotation_items (id, rotation_id, system_id, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)`,
      [itemIdB, rotationIdB, systemIdB, "member", crypto.randomUUID()],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON buckets TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON bucket_key_rotations TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON bucket_rotation_items TO ${APP_ROLE}`);

    for (const stmt of enableRls("buckets")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("buckets"));

    for (const stmt of enableRls("bucket_key_rotations")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("bucket_key_rotations"));

    for (const stmt of enableRls("bucket_rotation_items")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("bucket_rotation_items"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees rotation items for correct tenant", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM bucket_rotation_items`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(itemIdA);
  });

  it("returns empty when no system context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM bucket_rotation_items`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant rotation items not visible", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM bucket_rotation_items WHERE id = ${itemIdB}`);
    expect(result.rows).toHaveLength(0);
  });
});
