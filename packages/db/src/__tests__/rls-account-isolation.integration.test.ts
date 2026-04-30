/**
 * RLS account-isolation tests.
 *
 * Covers: tables where account_id is the sole tenant boundary.
 *   - auth_keys (account-scoped direct FK)
 *   - accounts table itself (account-pk — account_id IS the PK)
 *   - biometric_tokens (account-fk — FK subquery through sessions)
 *   - friend_connections (account-bidirectional — read by sender OR recipient)
 *
 * Companion files: rls-system-isolation, rls-dual-tenant, rls-systems-pk,
 *   rls-audit-log, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accountBidirectionalRlsPolicy,
  accountFkRlsPolicy,
  accountRlsPolicy,
  enableRls,
} from "../rls/policies.js";

import { pgInsertAccount } from "./helpers/pg-helpers.js";
import { APP_ROLE, createAccountsSchema, setSessionAccountId } from "./helpers/rls-test-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// 1. auth_keys — account-scoped (direct account_id FK)
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

    await createAccountsSchema(client);
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

    await pgInsertAccount(db, accountIdA);
    await pgInsertAccount(db, accountIdB);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO auth_keys (id, account_id, encrypted_private_key, public_key, key_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [authKeyIdA, accountIdA, new Uint8Array([1]), new Uint8Array([2]), "encryption", now],
    );
    await client.query(
      `INSERT INTO auth_keys (id, account_id, encrypted_private_key, public_key, key_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [authKeyIdB, accountIdB, new Uint8Array([3]), new Uint8Array([4]), "signing", now],
    );

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
// 2. accounts — account-pk scope (account_id IS the PK)
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — account-pk scope (PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = crypto.randomUUID();
  const accountIdB = crypto.randomUUID();

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createAccountsSchema(client);

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
// 3. biometric_tokens — account-fk scope (FK subquery through sessions)
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

    await createAccountsSchema(client);
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

    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON sessions TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON biometric_tokens TO ${APP_ROLE}`);

    for (const stmt of enableRls("sessions")) {
      await client.query(stmt);
    }
    await client.query(accountRlsPolicy("sessions"));

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
// 4. friend_connections — account-bidirectional (read by sender OR recipient)
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

    await createAccountsSchema(client);
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

    const now = new Date().toISOString();
    // A sends request to B
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

    const updateOwn = await db.execute(
      sql`UPDATE friend_connections SET status = 'accepted' WHERE id = ${connIdAtoB} RETURNING id`,
    );
    expect(updateOwn.rows).toHaveLength(1);

    const updateOther = await db.execute(
      sql`UPDATE friend_connections SET status = 'blocked' WHERE id = ${connIdBtoA} RETURNING id`,
    );
    expect(updateOther.rows).toHaveLength(0);
  });

  it("recipient can delete connection they received", async () => {
    await setSessionAccountId(db, accountIdB);

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
