import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RLS_TABLE_POLICIES } from "../rls/policies.js";

import { applyAllRlsToClient, createPgAllTables } from "./helpers/pg-helpers.js";

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

  it("policy count matches expected table count", async () => {
    const result = await client.query<PgPolicyRow>("SELECT DISTINCT tablename FROM pg_policies");
    const expectedCount = Object.keys(RLS_TABLE_POLICIES).length;
    expect(result.rows).toHaveLength(expectedCount);
  });
});
