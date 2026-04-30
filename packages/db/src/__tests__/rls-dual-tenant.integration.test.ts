/**
 * RLS dual-tenant tests.
 *
 * Covers: tables filtered by BOTH account_id AND system_id simultaneously.
 *   - api_keys (dual tenant: account_id + system_id)
 *   - import_jobs (dual tenant: account_id + system_id)
 *   - import_entity_refs (dual tenant: account_id + system_id)
 *
 * Companion files: rls-system-isolation, rls-account-isolation, rls-systems-pk,
 *   rls-audit-log, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dualTenantRlsPolicy, enableRls } from "../rls/policies.js";

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
// 1. api_keys — dual tenant (account_id + system_id)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — dual scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const apiKeyIdA = crypto.randomUUID();
  const apiKeyIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);
    await client.query(`
      CREATE TABLE api_keys (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        key_type VARCHAR(50) NOT NULL CHECK (key_type IN ('metadata', 'crypto')),
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        scopes JSONB NOT NULL,
        encrypted_data BYTEA NOT NULL,
        encrypted_key_material BYTEA,
        created_at TIMESTAMPTZ NOT NULL,
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        scoped_bucket_ids JSONB
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO api_keys (id, account_id, system_id, key_type, token_hash, scopes, encrypted_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        apiKeyIdA,
        accountIdA,
        systemIdA,
        "metadata",
        `hash_${apiKeyIdA}`,
        "[]",
        new Uint8Array([1]),
        now,
      ],
    );
    await client.query(
      `INSERT INTO api_keys (id, account_id, system_id, key_type, token_hash, scopes, encrypted_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        apiKeyIdB,
        accountIdB,
        systemIdB,
        "metadata",
        `hash_${apiKeyIdB}`,
        "[]",
        new Uint8Array([2]),
        now,
      ],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON api_keys TO ${APP_ROLE}`);

    for (const stmt of enableRls("api_keys")) {
      await client.query(stmt);
    }
    await client.query(dualTenantRlsPolicy("api_keys"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees api_keys for correct tenant (both GUCs set)", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM api_keys`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(apiKeyIdA);
  });

  it("returns empty when GUCs cleared (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM api_keys`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant INSERT blocked", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const now = new Date().toISOString();
    await expect(
      client.query(
        `INSERT INTO api_keys (id, account_id, system_id, key_type, token_hash, scopes, encrypted_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          accountIdB,
          systemIdB,
          "metadata",
          `hash_${crypto.randomUUID()}`,
          "[]",
          new Uint8Array([9]),
          now,
        ],
      ),
    ).rejects.toThrow();
  });

  it("cross-tenant UPDATE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(
      sql`UPDATE api_keys SET encrypted_data = ${new Uint8Array([99])} WHERE id = ${apiKeyIdB}`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await db.execute(sql`DELETE FROM api_keys WHERE id = ${apiKeyIdB}`);

    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM api_keys WHERE id = ${apiKeyIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2. import_jobs — dual tenant (account_id + system_id)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — import_jobs (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const jobIdA = crypto.randomUUID();
  const jobIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);
    await client.query(`
      CREATE TABLE import_jobs (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL CHECK (source IN ('simply-plural', 'pluralkit', 'pluralscape')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        progress_percent INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        chunks_completed INTEGER NOT NULL DEFAULT 0,
        chunks_total INTEGER,
        error_log JSONB,
        checkpoint_state JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        completed_at BIGINT
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = Date.now();
    await client.query(
      `INSERT INTO import_jobs (id, account_id, system_id, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [jobIdA, accountIdA, systemIdA, "simply-plural", now, now],
    );
    await client.query(
      `INSERT INTO import_jobs (id, account_id, system_id, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [jobIdB, accountIdB, systemIdB, "simply-plural", now, now],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON import_jobs TO ${APP_ROLE}`);

    for (const stmt of enableRls("import_jobs")) {
      await client.query(stmt);
    }
    await client.query(dualTenantRlsPolicy("import_jobs"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees import_jobs for correct tenant (both GUCs set)", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM import_jobs`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(jobIdA);
  });

  it("returns empty when GUCs cleared (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM import_jobs`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant INSERT blocked", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const now = Date.now();
    await expect(
      client.query(
        `INSERT INTO import_jobs (id, account_id, system_id, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), accountIdB, systemIdB, "simply-plural", now, now],
      ),
    ).rejects.toThrow();
  });

  it("cross-tenant UPDATE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(
      sql`UPDATE import_jobs SET progress_percent = 50 WHERE id = ${jobIdB}`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await db.execute(sql`DELETE FROM import_jobs WHERE id = ${jobIdB}`);

    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM import_jobs WHERE id = ${jobIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. import_entity_refs — dual tenant (account_id + system_id)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — import_entity_refs (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
  const refIdA = crypto.randomUUID();
  const refIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsAndSystemsSchema(client);
    await client.query(`
      CREATE TABLE import_entity_refs (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        system_id VARCHAR(255) NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL CHECK (source IN ('simply-plural', 'pluralkit', 'pluralscape')),
        source_entity_type VARCHAR(50) NOT NULL,
        source_entity_id VARCHAR(255) NOT NULL,
        pluralscape_entity_id VARCHAR(255) NOT NULL,
        imported_at BIGINT NOT NULL
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    const now = Date.now();
    await client.query(
      `INSERT INTO import_entity_refs (id, account_id, system_id, source, source_entity_type, source_entity_id, pluralscape_entity_id, imported_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [refIdA, accountIdA, systemIdA, "simply-plural", "member", "sp-a", "mem_a", now],
    );
    await client.query(
      `INSERT INTO import_entity_refs (id, account_id, system_id, source, source_entity_type, source_entity_id, pluralscape_entity_id, imported_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [refIdB, accountIdB, systemIdB, "simply-plural", "member", "sp-b", "mem_b", now],
    );

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON import_entity_refs TO ${APP_ROLE}`);

    for (const stmt of enableRls("import_entity_refs")) {
      await client.query(stmt);
    }
    await client.query(dualTenantRlsPolicy("import_entity_refs"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees import_entity_refs for correct tenant (both GUCs set)", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM import_entity_refs`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(refIdA);
  });

  it("returns empty when GUCs cleared (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM import_entity_refs`);
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant INSERT blocked", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const now = Date.now();
    await expect(
      client.query(
        `INSERT INTO import_entity_refs (id, account_id, system_id, source, source_entity_type, source_entity_id, pluralscape_entity_id, imported_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          accountIdB,
          systemIdB,
          "simply-plural",
          "member",
          "sp-x",
          "mem_x",
          now,
        ],
      ),
    ).rejects.toThrow();
  });

  it("cross-tenant UPDATE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(
      sql`UPDATE import_entity_refs SET source_entity_id = 'modified' WHERE id = ${refIdB}`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionAccountId(db, accountIdA);
    await setSessionSystemId(db, systemIdA);

    await db.execute(sql`DELETE FROM import_entity_refs WHERE id = ${refIdB}`);

    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM import_entity_refs WHERE id = ${refIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});
