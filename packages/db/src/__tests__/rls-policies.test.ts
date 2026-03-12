import { describe, expect, it } from "vitest";

import {
  accountRlsPolicy,
  dualTenantRlsPolicy,
  enableRls,
  generateRlsStatements,
  joinSystemRlsPolicy,
  RLS_TABLE_POLICIES,
  systemRlsPolicy,
} from "../rls/policies.js";

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

describe("joinSystemRlsPolicy", () => {
  it("generates EXISTS subquery for bucket parent", () => {
    const result = joinSystemRlsPolicy("key_grants", "buckets", "bucket_id");

    expect(result).toContain("CREATE POLICY key_grants_system_isolation ON key_grants");
    expect(result).toContain("EXISTS");
    expect(result).toContain("buckets.id = key_grants.bucket_id");
    expect(result).toContain("buckets.system_id =");
    expect(result).toContain("current_setting('app.current_system_id', true)");
  });

  it("generates EXISTS subquery for field_definitions parent", () => {
    const result = joinSystemRlsPolicy(
      "field_bucket_visibility",
      "field_definitions",
      "field_definition_id",
    );

    expect(result).toContain("field_definitions.id = field_bucket_visibility.field_definition_id");
    expect(result).toContain("field_definitions.system_id =");
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

  it("returns join-based policy for key_grants", () => {
    const stmts = generateRlsStatements("key_grants");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("EXISTS");
    expect(stmts[2]).toContain("buckets");
    expect(stmts[2]).not.toContain("key_grants.system_id");
  });

  it("returns join-based policy for field_bucket_visibility", () => {
    const stmts = generateRlsStatements("field_bucket_visibility");

    expect(stmts).toHaveLength(3);
    expect(stmts[2]).toContain("field_definitions");
  });

  it("throws for unknown table", () => {
    expect(() => generateRlsStatements("nonexistent")).toThrow(
      /No RLS policy defined for table 'nonexistent'/,
    );
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
      ["groups", "system"],
      ["journal_entries", "system"],
      ["api_keys", "dual"],
      ["audit_log", "dual"],
      ["device_tokens", "dual"],
      ["key_grants", "join-system"],
      ["bucket_content_tags", "join-system"],
      ["friend_bucket_assignments", "join-system"],
      ["field_bucket_visibility", "join-system"],
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
      "join-system",
      "join-system-chained",
    ]);

    for (const [table, scope] of Object.entries(RLS_TABLE_POLICIES)) {
      expect(validScopes.has(scope), `Invalid scope for ${table}: ${scope}`).toBe(true);
    }
  });
});
