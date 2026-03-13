import { describe, expect, it, vi } from "vitest";

import { applyAllRls } from "../rls/apply.js";
import {
  accountRlsPolicy,
  dropPolicySql,
  dualTenantRlsPolicy,
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  systemRlsPolicy,
} from "../rls/policies.js";

import type { RlsExecutor } from "../rls/apply.js";
import type { RlsScopeType } from "../rls/policies.js";

// ---------------------------------------------------------------------------
// enableRls
// ---------------------------------------------------------------------------

describe("enableRls", () => {
  it("returns an array of 2 statements", () => {
    const result = enableRls("members");

    expect(result).toHaveLength(2);
    expect(result[0]).toBe("ALTER TABLE members ENABLE ROW LEVEL SECURITY");
    expect(result[1]).toBe("ALTER TABLE members FORCE ROW LEVEL SECURITY");
  });
});

// ---------------------------------------------------------------------------
// Policy generators
// ---------------------------------------------------------------------------

describe("systemRlsPolicy", () => {
  it("generates USING clause with system_id and fail-closed NULLIF", () => {
    const result = systemRlsPolicy("members");

    expect(result).toContain("CREATE POLICY");
    expect(result).toContain("NULLIF(current_setting('app.current_system_id', true), '')::varchar");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("system_id =");
  });

  it("accepts custom id column for PK tables", () => {
    const result = systemRlsPolicy("systems", "id");

    expect(result).toContain("id =");
    expect(result).not.toContain("system_id =");
    expect(result).toContain("current_setting('app.current_system_id', true)");
  });
});

describe("accountRlsPolicy", () => {
  it("generates USING clause with account_id and fail-closed NULLIF", () => {
    const result = accountRlsPolicy("sessions");

    expect(result).toContain("CREATE POLICY");
    expect(result).toContain(
      "NULLIF(current_setting('app.current_account_id', true), '')::varchar",
    );
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("account_id =");
  });

  it("accepts custom id column for PK tables", () => {
    const result = accountRlsPolicy("accounts", "id");

    expect(result).toContain("id =");
    expect(result).not.toContain("account_id =");
    expect(result).toContain("current_setting('app.current_account_id', true)");
  });
});

describe("dualTenantRlsPolicy", () => {
  it("generates policy with both account_id and system_id checks", () => {
    const result = dualTenantRlsPolicy("api_keys");

    expect(result).toContain("CREATE POLICY api_keys_tenant_isolation ON api_keys");
    expect(result).toContain("account_id =");
    expect(result).toContain("system_id =");
    expect(result).toContain("current_setting('app.current_account_id', true)");
    expect(result).toContain("current_setting('app.current_system_id', true)");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
  });
});

// ---------------------------------------------------------------------------
// generateRlsStatements
// ---------------------------------------------------------------------------

describe("generateRlsStatements", () => {
  it("returns 3 statements for system-scoped table (enable + force + policy)", () => {
    const stmts = generateRlsStatements("members");

    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[1]).toContain("FORCE ROW LEVEL SECURITY");
    expect(stmts[2]).toContain("CREATE POLICY");
  });

  it("returns enable + policy for account-scoped table", () => {
    const stmts = generateRlsStatements("sessions");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("account_id");
  });

  it("returns enable + policy for system-pk table", () => {
    const stmts = generateRlsStatements("innerworld_canvas");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("system_id =");
  });

  it("returns id-based policy for systems table", () => {
    const stmts = generateRlsStatements("systems");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("id =");
    expect(stmts[2]).not.toContain("system_id =");
  });

  it("returns id-based policy for accounts table", () => {
    const stmts = generateRlsStatements("accounts");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("id =");
    expect(stmts[2]).not.toContain("account_id =");
  });

  it("returns dual-column policy for api_keys", () => {
    const stmts = generateRlsStatements("api_keys");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("account_id");
    expect(stmts[2]).toContain("system_id");
  });

  it("returns dual-column policy for audit_log", () => {
    const stmts = generateRlsStatements("audit_log");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("tenant_isolation");
  });

  it("returns direct system_id policy for key_grants", () => {
    const stmts = generateRlsStatements("key_grants");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("system_id =");
    expect(stmts[2]).not.toContain("EXISTS");
  });

  it("returns direct system_id policy for field_bucket_visibility", () => {
    const stmts = generateRlsStatements("field_bucket_visibility");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("system_id =");
    expect(stmts[2]).not.toContain("EXISTS");
  });

  it("accepts all RLS table names", () => {
    for (const tableName of Object.keys(RLS_TABLE_POLICIES) as Array<
      keyof typeof RLS_TABLE_POLICIES
    >) {
      const stmts = generateRlsStatements(tableName);
      expect(stmts.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ---------------------------------------------------------------------------
// RLS_TABLE_POLICIES
// ---------------------------------------------------------------------------

describe("RLS_TABLE_POLICIES", () => {
  it("covers core tables with correct scopes", () => {
    const expected: Array<[string, RlsScopeType]> = [
      ["members", "system"],
      ["systems", "system-pk"],
      ["accounts", "account-pk"],
      ["sessions", "account"],
      ["channels", "system"],
      ["buckets", "system"],
      ["fronting_sessions", "system"],
      ["switches", "system"],
      ["fronting_reports", "system"],
      ["groups", "system"],
      ["journal_entries", "system"],
      ["api_keys", "dual"],
      ["audit_log", "dual"],
      ["device_tokens", "dual"],
      ["key_grants", "system"],
      ["bucket_content_tags", "system"],
      ["friend_bucket_assignments", "system"],
      ["field_bucket_visibility", "system"],
      ["notification_configs", "system"],
      ["friend_notification_preferences", "system"],
      ["webhook_configs", "system"],
      ["webhook_deliveries", "system"],
      ["blob_metadata", "system"],
      ["timer_configs", "system"],
      ["check_in_records", "system"],
      ["search_index", "system"],
    ];

    for (const [table, scope] of expected) {
      expect(RLS_TABLE_POLICIES[table as keyof typeof RLS_TABLE_POLICIES]).toBe(scope);
    }
  });

  it("has system-pk scope for innerworld_canvas", () => {
    expect(RLS_TABLE_POLICIES.innerworld_canvas).toBe("system-pk");
  });

  it("has valid scope types for all entries", () => {
    const validScopes = new Set<RlsScopeType>([
      "system",
      "account",
      "system-pk",
      "account-pk",
      "dual",
    ]);

    for (const [table, scope] of Object.entries(RLS_TABLE_POLICIES)) {
      expect(validScopes.has(scope), `Invalid scope for ${table}: ${scope}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// dropPolicySql
// ---------------------------------------------------------------------------

describe("dropPolicySql", () => {
  it("extracts DROP POLICY from a CREATE POLICY statement", () => {
    const create =
      "CREATE POLICY members_system_isolation ON members USING (system_id = 'x') WITH CHECK (system_id = 'x')";
    expect(dropPolicySql(create)).toBe("DROP POLICY IF EXISTS members_system_isolation ON members");
  });

  it("returns null for non-CREATE POLICY statements", () => {
    expect(dropPolicySql("ALTER TABLE members ENABLE ROW LEVEL SECURITY")).toBeNull();
    expect(dropPolicySql("ALTER TABLE members FORCE ROW LEVEL SECURITY")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyAllRls (unit test with mock executor)
// ---------------------------------------------------------------------------

describe("applyAllRls", () => {
  it("executes BEGIN, statements, and COMMIT on success", async () => {
    const executed: string[] = [];
    const executor: RlsExecutor = {
      execute: vi.fn((sql: string) => {
        executed.push(sql);
        return Promise.resolve();
      }),
    };

    await applyAllRls(executor);

    expect(executed[0]).toBe("BEGIN");
    expect(executed[executed.length - 1]).toBe("COMMIT");
    // Every table should have at least ENABLE + FORCE + policy
    const tableCount = Object.keys(RLS_TABLE_POLICIES).length;
    // At minimum: BEGIN + (3 statements + 1 drop) * N tables + COMMIT
    expect(executed.length).toBeGreaterThan(tableCount * 3);
  });

  it("executes ROLLBACK on failure and rethrows", async () => {
    const executed: string[] = [];
    const executor: RlsExecutor = {
      execute: vi.fn((sql: string) => {
        executed.push(sql);
        if (sql.includes("ENABLE ROW LEVEL SECURITY")) {
          return Promise.reject(new Error("simulated failure"));
        }
        return Promise.resolve();
      }),
    };

    await expect(applyAllRls(executor)).rejects.toThrow("simulated failure");
    expect(executed[0]).toBe("BEGIN");
    expect(executed[executed.length - 1]).toBe("ROLLBACK");
    expect(executed).not.toContain("COMMIT");
  });
});
