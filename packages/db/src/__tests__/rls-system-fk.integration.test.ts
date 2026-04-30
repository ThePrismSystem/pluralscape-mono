/**
 * RLS system-fk tests.
 *
 * Covers: sync child tables isolated via FK join to sync_documents.
 *   - sync_changes (system-fk via document_id → sync_documents.system_id)
 *   - sync_snapshots (system-fk via document_id → sync_documents.system_id)
 *   - sync_conflicts (system-fk via document_id → sync_documents.system_id)
 *
 * Split from rls-system-isolation to keep each file under 500 LOC.
 *
 * Companion files: rls-system-isolation, rls-account-isolation, rls-dual-tenant,
 *   rls-systems-pk, rls-audit-log, rls-key-grants, rls-policy-generation.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableRls, systemFkRlsPolicy, systemRlsPolicy } from "../rls/policies.js";

import { createPgSyncTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";
import { setSessionSystemId } from "./helpers/rls-test-helpers.js";

import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ---------------------------------------------------------------------------
// sync_documents / sync_changes / sync_snapshots / sync_conflicts
// system-fk scope: child tables isolated via FK join to sync_documents
// ---------------------------------------------------------------------------

describe("RLS cross-tenant isolation — system-fk scope (sync tables, PGlite)", () => {
  let client: PGliteType;
  let db: PgliteDatabase<Record<string, unknown>>;

  const accountIdA = brandId<AccountId>(crypto.randomUUID());
  const accountIdB = brandId<AccountId>(crypto.randomUUID());
  const systemIdA = brandId<SystemId>(crypto.randomUUID());
  const systemIdB = brandId<SystemId>(crypto.randomUUID());
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

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO sync_documents (document_id, system_id, doc_type, created_at, updated_at, key_type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [docIdA, systemIdA, "system-core", now, now, "derived"],
    );
    await client.query(
      `INSERT INTO sync_documents (document_id, system_id, doc_type, created_at, updated_at, key_type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [docIdB, systemIdB, "system-core", now, now, "derived"],
    );

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

    await client.query(
      `INSERT INTO sync_conflicts (id, document_id, entity_type, entity_id, resolution, detected_at, summary, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [conflictIdA, docIdA, "member", "mem-1", "lww-field", now, "test conflict A", now],
    );
    await client.query(
      `INSERT INTO sync_conflicts (id, document_id, entity_type, entity_id, resolution, detected_at, summary, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [conflictIdB, docIdB, "member", "mem-2", "lww-field", now, "test conflict B", now],
    );

    await client.query(`CREATE ROLE app_user`);
    await client.query(`GRANT ALL ON sync_documents TO app_user`);
    await client.query(`GRANT ALL ON sync_changes TO app_user`);
    await client.query(`GRANT ALL ON sync_snapshots TO app_user`);
    await client.query(`GRANT ALL ON sync_conflicts TO app_user`);

    for (const stmt of enableRls("sync_documents")) {
      await client.query(stmt);
    }
    await client.query(systemRlsPolicy("sync_documents"));

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
