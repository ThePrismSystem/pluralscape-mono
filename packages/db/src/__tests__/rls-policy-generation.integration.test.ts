/**
 * RLS policy SQL generation tests (pure unit — no PGlite needed).
 *
 * Covers: SQL template correctness for all policy generators:
 *   enableRls, systemRlsPolicy, accountRlsPolicy, systemFkRlsPolicy,
 *   accountFkRlsPolicy, generateRlsStatements, RLS_TABLE_POLICIES coverage.
 *
 * Companion files: rls-system-isolation, rls-account-isolation,
 *   rls-dual-tenant, rls-systems-pk, rls-audit-log, rls-key-grants.
 */

import { describe, expect, it } from "vitest";

import {
  accountFkRlsPolicy,
  accountRlsPolicy,
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  systemFkRlsPolicy,
  systemRlsPolicy,
} from "../rls/policies.js";

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
