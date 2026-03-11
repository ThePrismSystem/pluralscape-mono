import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accountRlsPolicy,
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  systemRlsPolicy,
} from "../rls/policies.js";
import { members } from "../schema/pg/members.js";

import { pgInsertAccount, pgInsertSystem, pgInsertMember, testBlob } from "./helpers/pg-helpers.js";

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

  it("generateRlsStatements for system-scoped table returns enable + policy", () => {
    const stmts = generateRlsStatements("members");
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[2]).toContain("CREATE POLICY");
  });

  it("generateRlsStatements throws for unknown table", () => {
    expect(() => generateRlsStatements("nonexistent")).toThrow(
      /No RLS policy defined for table 'nonexistent'/,
    );
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
      "switches",
      "groups",
      "journal_entries",
      "api_keys",
      "audit_log",
      "key_grants",
      "bucket_content_tags",
      "friend_bucket_assignments",
      "field_bucket_visibility",
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
        password_hash VARCHAR(255) NOT NULL,
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
        version INTEGER NOT NULL DEFAULT 1
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
        archived_at TIMESTAMPTZ
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
        password_hash VARCHAR(255) NOT NULL,
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
        password_hash VARCHAR(255) NOT NULL,
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
        password_hash VARCHAR(255) NOT NULL,
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
        version INTEGER NOT NULL DEFAULT 1
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
