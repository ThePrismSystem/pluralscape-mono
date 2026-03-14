import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dropPolicySql, generateRlsStatements, RLS_TABLE_POLICIES } from "../rls/policies.js";

import { applyAllRlsToClient, createPgAllTables } from "./helpers/pg-helpers.js";

import type { RlsExecutor } from "../rls/apply.js";

interface PgPolicyRow {
  tablename: string;
  policyname: string;
}

describe("RLS migration bootstrap", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = await PGlite.create();
    await createPgAllTables(client);
    await applyAllRlsToClient(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("applies RLS to every table in RLS_TABLE_POLICIES", async () => {
    const result = await client.query<PgPolicyRow>(
      "SELECT tablename, policyname FROM pg_policies ORDER BY tablename",
    );
    const policiedTables = new Set(result.rows.map((r) => r.tablename));
    const expectedTables = Object.keys(RLS_TABLE_POLICIES);

    for (const table of expectedTables) {
      expect(policiedTables.has(table), `Missing RLS policy for table: ${table}`).toBe(true);
    }
  });

  it("every RLS-protected table has FORCE enabled", async () => {
    const result = await client.query<{ relname: string; relforcerowsecurity: boolean }>(
      `SELECT c.relname, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relrowsecurity = true`,
    );
    const forcedTables = new Set(
      result.rows.filter((r) => r.relforcerowsecurity).map((r) => r.relname),
    );
    const expectedTables = Object.keys(RLS_TABLE_POLICIES);

    for (const table of expectedTables) {
      expect(forcedTables.has(table), `FORCE ROW LEVEL SECURITY not set for: ${table}`).toBe(true);
    }
  });

  it("applyAllRls is idempotent (second run does not error)", async () => {
    await expect(applyAllRlsToClient(client)).resolves.toBeUndefined();
  });

  it("exactly one policy per RLS-protected table", async () => {
    const result = await client.query<PgPolicyRow>("SELECT DISTINCT tablename FROM pg_policies");
    const expectedCount = Object.keys(RLS_TABLE_POLICIES).length;
    expect(result.rows).toHaveLength(expectedCount);
  });

  it("migration file matches regenerated output (sync guard)", () => {
    const migrationPath = resolve(__dirname, "../../migrations/pg/0002_rls_all_tables.sql");
    const onDisk = readFileSync(migrationPath, "utf-8");

    // Regenerate using the same logic as generate-rls-migration.ts
    const lines: string[] = [];
    lines.push("-- RLS policies for all tenant tables");
    lines.push("-- Generated from RLS_TABLE_POLICIES in src/rls/policies.ts");
    lines.push("");

    for (const tableName of Object.keys(RLS_TABLE_POLICIES) as Array<
      keyof typeof RLS_TABLE_POLICIES
    >) {
      lines.push(`-- ${tableName}`);
      const statements = generateRlsStatements(tableName);
      for (const stmt of statements) {
        const drop = dropPolicySql(stmt);
        if (drop) {
          lines.push(`${drop};`);
        }
        lines.push(`${stmt};`);
      }
      lines.push("");
    }

    const regenerated = `${lines.join("\n")}\n`;
    expect(onDisk).toBe(regenerated);
  });
});

describe("RLS partial-failure atomicity", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = await PGlite.create();
    // Only create accounts — skip the rest so applyAllRls fails mid-way
    await client.query(`
      CREATE TABLE accounts (
        id VARCHAR(50) PRIMARY KEY,
        email_hash VARCHAR(255) NOT NULL UNIQUE,
        email_salt VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        kdf_salt VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it("rolls back all policies on partial failure", async () => {
    const executor: RlsExecutor = {
      async execute(statement: string): Promise<void> {
        await client.query(statement);
      },
    };

    const { applyAllRls } = await import("../rls/apply.js");
    await expect(applyAllRls(executor)).rejects.toThrow();

    // Verify no policies remain after rollback
    const result = await client.query<PgPolicyRow>("SELECT tablename, policyname FROM pg_policies");
    expect(result.rows).toHaveLength(0);
  });
});
