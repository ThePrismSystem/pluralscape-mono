import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  systemRlsPolicy,
  accountRlsPolicy,
  systemsTableRlsPolicy,
  accountsTableRlsPolicy,
} from "../rls/policies.js";
import { members } from "../schema/pg/members.js";

import { pgInsertAccount, pgInsertSystem, pgInsertMember } from "./helpers/pg-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_ROLE = "app_user";

/** Execute a multi-statement SQL string (split on ";") via PGlite. */
async function pgExec(client: PGliteType, sqlText: string): Promise<void> {
  const statements = sqlText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

/**
 * Set session-scoped system context for RLS tests.
 * Uses Drizzle's execute so the setting applies to subsequent Drizzle queries
 * within the same PGlite session.
 */
async function setSessionSystemId(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_system_id', ${systemId}, false)`);
}

// ---------------------------------------------------------------------------
// 1. RLS policy SQL generation (pure unit tests — no PGlite needed)
// ---------------------------------------------------------------------------

describe("RLS policy SQL generation", () => {
  it("enableRls generates correct SQL", () => {
    const result = enableRls("members");
    expect(result).toContain("ENABLE ROW LEVEL SECURITY");
    expect(result).toContain("FORCE ROW LEVEL SECURITY");
    expect(result).toContain("members");
  });

  it("systemRlsPolicy generates correct policy", () => {
    const result = systemRlsPolicy("members");
    expect(result).toContain("current_setting('app.current_system_id')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
  });

  it("accountRlsPolicy generates correct policy", () => {
    const result = accountRlsPolicy("sessions");
    expect(result).toContain("current_setting('app.current_account_id')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
  });

  it("systemsTableRlsPolicy uses id column", () => {
    const result = systemsTableRlsPolicy();
    expect(result).toContain("id =");
    expect(result).not.toContain("system_id =");
  });

  it("accountsTableRlsPolicy uses id column", () => {
    const result = accountsTableRlsPolicy();
    expect(result).toContain("id =");
    expect(result).not.toContain("account_id =");
  });

  it("generateRlsStatements for system-scoped table returns enable + policy", () => {
    const stmts = generateRlsStatements("members");
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[1]).toContain("CREATE POLICY");
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
    ];
    for (const table of expectedTables) {
      expect(RLS_TABLE_POLICIES).toHaveProperty(table);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. RLS cross-tenant isolation (PGlite integration tests)
//
// PGlite runs as the postgres superuser, which bypasses RLS even with FORCE.
// To exercise policies we CREATE ROLE app_user, GRANT permissions, and
// SET ROLE app_user before issuing DML. This mirrors how a real deployment
// would configure an unprivileged application role.
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  // Pre-generated IDs so we can reference them across tests
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

    // --- DDL: create tables as superuser ---
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

    // --- Seed data as superuser (no RLS yet) ---
    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);
    await pgInsertSystem(db, accountIdA, systemIdA);
    await pgInsertSystem(db, accountIdB, systemIdB);
    await pgInsertMember(db, systemIdA, memberIdA1);
    await pgInsertMember(db, systemIdA, memberIdA2);
    await pgInsertMember(db, systemIdB, memberIdB1);

    // --- Create unprivileged app role and grant access ---
    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON systems TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON members TO ${APP_ROLE}`);

    // --- Enable RLS + policy on members using the project's generators ---
    await pgExec(client, enableRls("members"));
    await client.query(systemRlsPolicy("members"));

    // --- Switch to unprivileged role for all subsequent queries ---
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

  it("returns empty when no context set (fail-closed)", async () => {
    // Set context to a UUID that owns no rows
    await setSessionSystemId(db, crypto.randomUUID());

    const rows = await db.select().from(members);

    expect(rows).toHaveLength(0);
  });

  it("WITH CHECK prevents cross-tenant INSERT", async () => {
    await setSessionSystemId(db, systemIdA);

    // Attempt to insert a member belonging to system B while context is A
    const crossTenantId = crypto.randomUUID();
    const now = Date.now();

    await expect(
      db.insert(members).values({
        id: crossTenantId,
        systemId: systemIdB,
        encryptedData: new Uint8Array([9, 9, 9]),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("changing context switches visible rows", async () => {
    // Verify system A
    await setSessionSystemId(db, systemIdA);
    const rowsA = await db.select().from(members);
    expect(rowsA).toHaveLength(2);
    for (const row of rowsA) {
      expect(row.systemId).toBe(systemIdA);
    }

    // Switch to system B
    await setSessionSystemId(db, systemIdB);
    const rowsB = await db.select().from(members);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]?.systemId).toBe(systemIdB);
    expect(rowsB[0]?.id).toBe(memberIdB1);
  });
});
