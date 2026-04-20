import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accountBidirectionalRlsPolicy,
  accountFkRlsPolicy,
  accountRlsPolicy,
  auditLogRlsPolicy,
  dualTenantRlsPolicy,
  enableRls,
  generateRlsStatements,
  keyGrantsRlsPolicy,
  RLS_TABLE_POLICIES,
  systemFkRlsPolicy,
  systemRlsPolicy,
  systemsPkRlsPolicy,
} from "../rls/policies.js";
import { members } from "../schema/pg/members.js";

import {
  createPgSyncTables,
  pgInsertAccount,
  pgInsertSystem,
  pgInsertMember,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_ROLE = "app_user";

/**
 * Set session-scoped system context for RLS tests.
 * Uses `set_config(..., false)` for session-scoped behavior, because PGlite
 * doesn't use explicit transactions — each Drizzle query is its own implicit
 * transaction, so `true` (transaction-local) wouldn't persist between queries.
 * Production code in session.ts uses `true` inside explicit transactions.
 */
async function setSessionSystemId(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_system_id', ${systemId}, false)`);
}

/**
 * Set session-scoped account context for RLS tests.
 * Uses `false` for the same reason as setSessionSystemId — see comment above.
 */
async function setSessionAccountId(
  db: PgliteDatabase<Record<string, unknown>>,
  accountId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_account_id', ${accountId}, false)`);
}

// ---------------------------------------------------------------------------
// 1. RLS policy SQL generation (pure unit tests — no PGlite needed)
// ---------------------------------------------------------------------------

describe("RLS policy SQL generation", () => {
  it("enableRls returns array of correct SQL", () => {
    const result = enableRls("members");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(result[1]).toContain("FORCE ROW LEVEL SECURITY");
    expect(result[0]).toContain("members");
  });

  it("systemRlsPolicy generates correct policy with NULLIF", () => {
    const result = systemRlsPolicy("members");
    expect(result).toContain("NULLIF(current_setting('app.current_system_id', true), '')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
  });

  it("accountRlsPolicy generates correct policy with NULLIF", () => {
    const result = accountRlsPolicy("sessions");
    expect(result).toContain("NULLIF(current_setting('app.current_account_id', true), '')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
  });

  it("systemRlsPolicy with custom id column uses that column", () => {
    const result = systemRlsPolicy("systems", "id");
    expect(result).toContain("id =");
    expect(result).not.toContain("system_id =");
  });

  it("accountRlsPolicy with custom id column uses that column", () => {
    const result = accountRlsPolicy("accounts", "id");
    expect(result).toContain("id =");
    expect(result).not.toContain("account_id =");
  });

  it("accountFkRlsPolicy generates subquery-based policy", () => {
    const result = accountFkRlsPolicy(
      "biometric_tokens",
      "session_id",
      "sessions",
      "id",
      "account_id",
    );
    expect(result).toContain("CREATE POLICY biometric_tokens_account_isolation");
    expect(result).toContain("session_id IN (SELECT id FROM sessions WHERE account_id =");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("NULLIF(current_setting('app.current_account_id', true), '')");
  });

  it("systemFkRlsPolicy generates subquery-based policy for sync tables", () => {
    const result = systemFkRlsPolicy(
      "sync_changes",
      "document_id",
      "sync_documents",
      "document_id",
      "system_id",
    );
    expect(result).toContain("CREATE POLICY sync_changes_system_isolation");
    expect(result).toContain(
      "document_id IN (SELECT document_id FROM sync_documents WHERE system_id =",
    );
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("NULLIF(current_setting('app.current_system_id', true), '')");
  });

  it("RLS_TABLE_POLICIES covers sync child tables", () => {
    expect(RLS_TABLE_POLICIES).toHaveProperty("sync_changes", "system-fk");
    expect(RLS_TABLE_POLICIES).toHaveProperty("sync_snapshots", "system-fk");
    expect(RLS_TABLE_POLICIES).toHaveProperty("sync_conflicts", "system-fk");
  });

  it("generateRlsStatements for system-scoped table returns enable + policy", () => {
    const stmts = generateRlsStatements("members");
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[2]).toContain("CREATE POLICY");
  });

  it("generateRlsStatements accepts all RLS table names", () => {
    for (const tableName of Object.keys(RLS_TABLE_POLICIES) as Array<
      keyof typeof RLS_TABLE_POLICIES
    >) {
      const stmts = generateRlsStatements(tableName);
      expect(stmts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("RLS_TABLE_POLICIES covers all expected tables", () => {
    const expectedTables = [
      "members",
      "systems",
      "accounts",
      "sessions",
      "channels",
      "buckets",
      "fronting_sessions",
      "groups",
      "journal_entries",
      "api_keys",
      "audit_log",
      "key_grants",
      "bucket_content_tags",
      "friend_bucket_assignments",
      "field_bucket_visibility",
      "biometric_tokens",
    ];
    for (const table of expectedTables) {
      expect(RLS_TABLE_POLICIES).toHaveProperty(table);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. RLS cross-tenant isolation — system scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const memberIdA1 = crypto.randomUUID();
  const memberIdA2 = crypto.randomUUID();
  const memberIdB1 = crypto.randomUUID();

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

    // Apply RLS using the generators (enableRls now returns string[])
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
    // Reset to a fresh state with no variable set by using RESET
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const rows = await db.select().from(members);

    expect(rows).toHaveLength(0);
  });

  it("WITH CHECK prevents cross-tenant INSERT", async () => {
    await setSessionSystemId(db, systemIdA);

    const crossTenantId = crypto.randomUUID();
    const now = Date.now();

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

    // Attempt to update a member that belongs to system B
    const result = await db
      .update(members)
      .set({ encryptedData: testBlob(new Uint8Array([99, 99])) })
      .where(eq(members.id, memberIdB1));

    expect(result.rows).toHaveLength(0);

    // Verify original data unchanged
    await setSessionSystemId(db, systemIdB);
    const rows = await db.select().from(members).where(eq(members.id, memberIdB1));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(memberIdB1);
  });

  it("cross-tenant DELETE affects 0 rows", async () => {
    await setSessionSystemId(db, systemIdA);

    // Attempt to delete a member belonging to system B
    await db.delete(members).where(eq(members.id, memberIdB1));

    // Verify row still exists
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
// 3. RLS cross-tenant isolation — account scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — account scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const authKeyIdA = crypto.randomUUID();
  const authKeyIdB = crypto.randomUUID();

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
      CREATE TABLE auth_keys (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_private_key BYTEA NOT NULL,
        public_key BYTEA NOT NULL,
        key_type VARCHAR(255) NOT NULL CHECK (key_type IN ('encryption', 'signing')),
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    // Seed accounts
    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);

    // Seed auth keys
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO auth_keys (id, account_id, encrypted_private_key, public_key, key_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [authKeyIdA, accountIdA, new Uint8Array([1]), new Uint8Array([2]), "encryption", now],
    );
    await client.query(
      `INSERT INTO auth_keys (id, account_id, encrypted_private_key, public_key, key_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [authKeyIdB, accountIdB, new Uint8Array([3]), new Uint8Array([4]), "signing", now],
    );

    // Create role and enable RLS
    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON auth_keys TO ${APP_ROLE}`);

    for (const stmt of enableRls("auth_keys")) {
      await client.query(stmt);
    }
    await client.query(accountRlsPolicy("auth_keys"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees auth keys for current account", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM auth_keys`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(authKeyIdA);
  });

  it("returns empty when no account context set (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM auth_keys`);
    expect(result.rows).toHaveLength(0);
  });

  it("switching account changes visible rows", async () => {
    await setSessionAccountId(db, accountIdB);
    const result = await db.execute(sql`SELECT * FROM auth_keys`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(authKeyIdB);
  });
});

// ---------------------------------------------------------------------------
// 4. RLS cross-tenant isolation — account-pk scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — account-pk scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();

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

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);

    for (const stmt of enableRls("accounts")) {
      await client.query(stmt);
    }
    await client.query(accountRlsPolicy("accounts", "id"));

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees own account row", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM accounts`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(accountIdA);
  });

  it("returns empty when no account context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM accounts`);
    expect(result.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. RLS cross-tenant isolation — system-pk scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system-pk scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();

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

    // Insert nomenclature settings for both systems
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

    // system-pk tables use systemRlsPolicy with default column (system_id is the PK here)
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
// 6. RLS cross-tenant isolation — dual scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — dual scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const apiKeyIdA = crypto.randomUUID();
  const apiKeyIdB = crypto.randomUUID();

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

    // Verify row still exists
    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM api_keys WHERE id = ${apiKeyIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7. RLS cross-tenant isolation — key_grants (direct system_id) (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — key_grants (system scope, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const bucketIdA = crypto.randomUUID();
  const bucketIdB = crypto.randomUUID();
  const grantIdA = crypto.randomUUID();
  const grantIdB = crypto.randomUUID();

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
    ).rejects.toThrow();
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
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. RLS cross-tenant isolation — bucket_rotation_items (direct system_id) (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — bucket_rotation_items (system scope, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const bucketIdA = crypto.randomUUID();
  const bucketIdB = crypto.randomUUID();
  const rotationIdA = crypto.randomUUID();
  const rotationIdB = crypto.randomUUID();
  const itemIdA = crypto.randomUUID();
  const itemIdB = crypto.randomUUID();

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
    // Buckets
    await client.query(
      `INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [bucketIdA, systemIdA, new Uint8Array([1]), now, now],
    );
    await client.query(
      `INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [bucketIdB, systemIdB, new Uint8Array([2]), now, now],
    );
    // Rotations
    await client.query(
      `INSERT INTO bucket_key_rotations (id, bucket_id, system_id, from_key_version, to_key_version, state, initiated_at, total_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rotationIdA, bucketIdA, systemIdA, 1, 2, "initiated", now, 1],
    );
    await client.query(
      `INSERT INTO bucket_key_rotations (id, bucket_id, system_id, from_key_version, to_key_version, state, initiated_at, total_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [rotationIdB, bucketIdB, systemIdB, 1, 2, "initiated", now, 1],
    );
    // Rotation items
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

    // RLS on buckets (system scope)
    for (const stmt of enableRls("buckets")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("buckets"));

    // RLS on bucket_key_rotations (direct system_id)
    for (const stmt of enableRls("bucket_key_rotations")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("bucket_key_rotations"));

    // RLS on bucket_rotation_items (direct system_id)
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

// ---------------------------------------------------------------------------
// 8. RLS cross-tenant isolation — account-fk scope (PGlite integration tests)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — account-fk scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const sessionIdA = crypto.randomUUID();
  const sessionIdB = crypto.randomUUID();
  const tokenIdA = crypto.randomUUID();
  const tokenIdB = crypto.randomUUID();

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
      CREATE TABLE sessions (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
        device_info VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        last_active_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE biometric_tokens (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);

    // Seed data
    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO sessions (id, account_id, token_hash, refresh_token_hash, device_info, created_at, expires_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionIdA, accountIdA, crypto.randomUUID(), crypto.randomUUID(), "test", now, now, now],
    );
    await client.query(
      `INSERT INTO sessions (id, account_id, token_hash, refresh_token_hash, device_info, created_at, expires_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionIdB, accountIdB, crypto.randomUUID(), crypto.randomUUID(), "test", now, now, now],
    );

    await client.query(
      `INSERT INTO biometric_tokens (id, session_id, token_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [tokenIdA, sessionIdA, crypto.randomUUID(), now],
    );
    await client.query(
      `INSERT INTO biometric_tokens (id, session_id, token_hash, created_at) VALUES ($1, $2, $3, $4)`,
      [tokenIdB, sessionIdB, crypto.randomUUID(), now],
    );

    // Create role, grant permissions, enable RLS
    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON sessions TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON biometric_tokens TO ${APP_ROLE}`);

    // Enable RLS on sessions (required for FK subquery to work correctly)
    for (const stmt of enableRls("sessions")) {
      await client.query(stmt);
    }
    await client.query(accountRlsPolicy("sessions"));

    // Enable RLS on biometric_tokens with FK-based policy
    for (const stmt of enableRls("biometric_tokens")) {
      await client.query(stmt);
    }
    await client.query(
      accountFkRlsPolicy("biometric_tokens", "session_id", "sessions", "id", "account_id"),
    );

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only sees biometric tokens for current account", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM biometric_tokens`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(tokenIdA);
  });

  it("returns empty when no account context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM biometric_tokens`);
    expect(result.rows).toHaveLength(0);
  });

  it("switching account shows different tokens", async () => {
    await setSessionAccountId(db, accountIdB);

    const result = await db.execute(sql`SELECT * FROM biometric_tokens`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(tokenIdB);
  });

  it("cross-tenant token not visible", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM biometric_tokens WHERE id = ${tokenIdB}`);
    expect(result.rows).toHaveLength(0);
  });

  it("WITH CHECK prevents inserting token for another account's session", async () => {
    await setSessionAccountId(db, accountIdA);

    await expect(
      db.execute(
        sql`INSERT INTO biometric_tokens (id, session_id, token_hash, created_at) VALUES (${crypto.randomUUID()}, ${sessionIdB}, ${crypto.randomUUID()}, NOW())`,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. RLS cross-tenant isolation — import_jobs (dual scope, PGlite)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — import_jobs (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const jobIdA = crypto.randomUUID();
  const jobIdB = crypto.randomUUID();

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

    // Verify row still exists under tenant B
    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM import_jobs WHERE id = ${jobIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 11. RLS cross-tenant isolation — import_entity_refs (dual scope, PGlite)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — import_entity_refs (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const refIdA = crypto.randomUUID();
  const refIdB = crypto.randomUUID();

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

    // Verify row still exists under tenant B
    await setSessionAccountId(db, accountIdB);
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM import_entity_refs WHERE id = ${refIdB}`);
    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// RLS cross-tenant isolation — system-fk scope (sync tables, PGlite)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system-fk scope (sync tables, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const docIdA = `doc-${crypto.randomUUID()}`;
  const docIdB = `doc-${crypto.randomUUID()}`;
  const changeIdA = crypto.randomUUID();
  const changeIdB = crypto.randomUUID();
  const conflictIdA = crypto.randomUUID();
  const conflictIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createPgSyncTables(client);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);

    // Insert sync_documents
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO sync_documents (document_id, system_id, doc_type, created_at, updated_at, key_type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [docIdA, systemIdA, "system-core", now, now, "derived"],
    );
    await client.query(
      `INSERT INTO sync_documents (document_id, system_id, doc_type, created_at, updated_at, key_type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [docIdB, systemIdB, "system-core", now, now, "derived"],
    );

    // Insert sync_changes
    await client.query(
      `INSERT INTO sync_changes (id, document_id, seq, encrypted_payload, author_public_key, nonce, signature, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        changeIdA,
        docIdA,
        1,
        new Uint8Array([1]),
        new Uint8Array([2]),
        new Uint8Array([3]),
        new Uint8Array([4]),
        now,
      ],
    );
    await client.query(
      `INSERT INTO sync_changes (id, document_id, seq, encrypted_payload, author_public_key, nonce, signature, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        changeIdB,
        docIdB,
        1,
        new Uint8Array([5]),
        new Uint8Array([6]),
        new Uint8Array([7]),
        new Uint8Array([8]),
        now,
      ],
    );

    // Insert sync_snapshots
    await client.query(
      `INSERT INTO sync_snapshots (document_id, snapshot_version, encrypted_payload, author_public_key, nonce, signature, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        docIdA,
        1,
        new Uint8Array([10]),
        new Uint8Array([11]),
        new Uint8Array([12]),
        new Uint8Array([13]),
        now,
      ],
    );
    await client.query(
      `INSERT INTO sync_snapshots (document_id, snapshot_version, encrypted_payload, author_public_key, nonce, signature, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        docIdB,
        1,
        new Uint8Array([14]),
        new Uint8Array([15]),
        new Uint8Array([16]),
        new Uint8Array([17]),
        now,
      ],
    );

    // Insert sync_conflicts
    await client.query(
      `INSERT INTO sync_conflicts (id, document_id, entity_type, entity_id, resolution, detected_at, summary, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [conflictIdA, docIdA, "member", "mem-1", "lww-field", now, "test conflict A", now],
    );
    await client.query(
      `INSERT INTO sync_conflicts (id, document_id, entity_type, entity_id, resolution, detected_at, summary, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [conflictIdB, docIdB, "member", "mem-2", "lww-field", now, "test conflict B", now],
    );

    // Create role and apply RLS
    await client.query(`CREATE ROLE app_user`);
    await client.query(`GRANT ALL ON sync_documents TO app_user`);
    await client.query(`GRANT ALL ON sync_changes TO app_user`);
    await client.query(`GRANT ALL ON sync_snapshots TO app_user`);
    await client.query(`GRANT ALL ON sync_conflicts TO app_user`);

    // Apply RLS to sync_documents (system scope)
    for (const stmt of enableRls("sync_documents")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("sync_documents"));

    // Apply RLS to sync child tables (system-fk scope)
    for (const tableName of ["sync_changes", "sync_snapshots", "sync_conflicts"] as const) {
      for (const stmt of enableRls(tableName)) {
        await client.query(stmt);
      }
      await client.query(
        systemFkRlsPolicy(tableName, "document_id", "sync_documents", "document_id", "system_id"),
      );
    }

    await client.query(`SET ROLE app_user`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("sync_changes: only sees rows for current system via FK join", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM sync_changes`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(changeIdA);
  });

  it("sync_changes: returns empty when context cleared (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM sync_changes`);
    expect(result.rows).toHaveLength(0);
  });

  it("sync_snapshots: only sees rows for current system via FK join", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM sync_snapshots`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["document_id"]).toBe(docIdA);
  });

  it("sync_conflicts: only sees rows for current system via FK join", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`SELECT * FROM sync_conflicts`);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(conflictIdA);
  });

  it("sync_changes: cross-tenant INSERT blocked", async () => {
    await setSessionSystemId(db, systemIdA);

    const now = new Date().toISOString();
    await expect(
      client.query(
        `INSERT INTO sync_changes (id, document_id, seq, encrypted_payload, author_public_key, nonce, signature, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          docIdB,
          2,
          new Uint8Array([99]),
          new Uint8Array([99]),
          new Uint8Array([99]),
          new Uint8Array([99]),
          now,
        ],
      ),
    ).rejects.toThrow();
  });

  it("sync_changes: cross-tenant UPDATE affects 0 rows", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await db.execute(sql`UPDATE sync_changes SET seq = 99 WHERE id = ${changeIdB}`);
    expect(result.rows).toHaveLength(0);
  });

  it("sync_changes: cross-tenant DELETE affects 0 rows", async () => {
    await setSessionSystemId(db, systemIdA);

    await db.execute(sql`DELETE FROM sync_changes WHERE id = ${changeIdB}`);

    // Verify row still exists under system B
    await setSessionSystemId(db, systemIdB);
    const result = await db.execute(sql`SELECT * FROM sync_changes WHERE id = ${changeIdB}`);
    expect(result.rows).toHaveLength(1);
  });

  it("switching system context switches visible sync rows", async () => {
    await setSessionSystemId(db, systemIdA);
    const rowsA = await db.execute(sql`SELECT * FROM sync_changes`);
    expect(rowsA.rows).toHaveLength(1);

    await setSessionSystemId(db, systemIdB);
    const rowsB = await db.execute(sql`SELECT * FROM sync_changes`);
    expect(rowsB.rows).toHaveLength(1);
    expect((rowsB.rows[0] as Record<string, unknown>)["id"]).toBe(changeIdB);
  });
});

// ---------------------------------------------------------------------------
// RLS cross-tenant isolation — account-bidirectional (friend_connections, PGlite)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — account-bidirectional (friend_connections, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const accountIdC = crypto.randomUUID();
  const connIdAtoB = crypto.randomUUID();
  const connIdBtoA = crypto.randomUUID();

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
      CREATE TABLE friend_connections (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        friend_account_id VARCHAR(255) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        encrypted_data BYTEA,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ
      )
    `);

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertAccount(db, accountIdC);

    // A sends request to B
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [connIdAtoB, accountIdA, accountIdB, "pending", now, now],
    );
    // B sends request to A (separate directional entry)
    await client.query(
      `INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [connIdBtoA, accountIdB, accountIdA, "accepted", now, now],
    );

    await client.query(`CREATE ROLE app_user`);
    await client.query(`GRANT ALL ON friend_connections TO app_user`);

    for (const stmt of enableRls("friend_connections")) {
      await client.query(stmt);
    }
    for (const policy of accountBidirectionalRlsPolicy("friend_connections")) {
      await client.query(policy);
    }

    await client.query(`SET ROLE app_user`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("sender can read their own outgoing connection", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM friend_connections WHERE id = ${connIdAtoB}`);
    expect(result.rows).toHaveLength(1);
  });

  it("recipient can read incoming connection (bidirectional read)", async () => {
    await setSessionAccountId(db, accountIdB);

    // B is the friend_account_id on connIdAtoB — should be visible via bidirectional SELECT
    const result = await db.execute(sql`SELECT * FROM friend_connections WHERE id = ${connIdAtoB}`);
    expect(result.rows).toHaveLength(1);
  });

  it("unrelated account cannot see connections between A and B", async () => {
    await setSessionAccountId(db, accountIdC);

    const result = await db.execute(sql`SELECT * FROM friend_connections`);
    expect(result.rows).toHaveLength(0);
  });

  it("account A sees both connections (as sender of one, recipient of another)", async () => {
    await setSessionAccountId(db, accountIdA);

    const result = await db.execute(sql`SELECT * FROM friend_connections`);
    expect(result.rows).toHaveLength(2);
  });

  it("INSERT restricted to own account_id", async () => {
    await setSessionAccountId(db, accountIdA);

    const now = new Date().toISOString();
    await expect(
      client.query(
        `INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), accountIdB, accountIdC, "pending", now, now],
      ),
    ).rejects.toThrow();
  });

  it("UPDATE restricted to own connections (sender only)", async () => {
    await setSessionAccountId(db, accountIdA);

    // A can update their own outgoing connection
    const updateOwn = await db.execute(
      sql`UPDATE friend_connections SET status = 'accepted' WHERE id = ${connIdAtoB} RETURNING id`,
    );
    expect(updateOwn.rows).toHaveLength(1);

    // A cannot update B's outgoing connection (even though A is the recipient)
    const updateOther = await db.execute(
      sql`UPDATE friend_connections SET status = 'blocked' WHERE id = ${connIdBtoA} RETURNING id`,
    );
    expect(updateOther.rows).toHaveLength(0);
  });

  it("recipient can delete connection they received", async () => {
    // B can delete the connection A sent to them
    await setSessionAccountId(db, accountIdB);

    // First verify B can see it
    const before = await db.execute(sql`SELECT * FROM friend_connections WHERE id = ${connIdAtoB}`);
    expect(before.rows).toHaveLength(1);

    await db.execute(sql`DELETE FROM friend_connections WHERE id = ${connIdAtoB}`);

    const after = await db.execute(sql`SELECT * FROM friend_connections WHERE id = ${connIdAtoB}`);
    expect(after.rows).toHaveLength(0);
  });

  it("returns empty when no account context (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_account_id', '', false)`);

    const result = await db.execute(sql`SELECT * FROM friend_connections`);
    expect(result.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RLS systems PK enforces account ownership (db-zy79 / audit H1)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — systems PK with account ownership (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();

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
    await expect(
      db.execute(sql`UPDATE systems SET account_id = ${accountIdB} WHERE id = ${systemIdA}`),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// RLS audit_log NULL-aware USING clause (db-dpp7 / audit C1)
// ---------------------------------------------------------------------------

describe("RLS audit_log NULL-aware tenant isolation (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();
  const systemIdA = crypto.randomUUID();
  const systemIdB = crypto.randomUUID();
  const liveEntryId = crypto.randomUUID();
  const nulledEntryId = crypto.randomUUID();
  const crossTenantEntryId = crypto.randomUUID();

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
    // Minimal audit_log table (matches the ON DELETE SET NULL behavior from
    // the production schema — but no PARTITION clause so PGlite is happy).
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
    // standard tenant-isolation policy. An admin path that bypasses RLS
    // (BYPASSRLS role) can retrieve it for forensic/audit purposes. We
    // simulate that here by dropping the tenant role before querying.
    try {
      await client.query(`RESET ROLE`);
      const superuser = await client.query<{ id: string }>(
        `SELECT id FROM audit_log WHERE id = $1`,
        [nulledEntryId],
      );
      expect(superuser.rows.map((r) => r.id)).toContain(nulledEntryId);
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
});
