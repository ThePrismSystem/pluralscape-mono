import { describe, expect, it } from "vitest";

import {
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  systemRlsPolicy,
  accountRlsPolicy,
  systemsTableRlsPolicy,
  accountsTableRlsPolicy,
  systemPkRlsPolicy,
} from "../rls/policies.js";

import type { RlsScopeType } from "../rls/policies.js";

// ---------------------------------------------------------------------------
// enableRls
// ---------------------------------------------------------------------------

describe("enableRls", () => {
  it("generates ENABLE and FORCE ROW LEVEL SECURITY", () => {
    const result = enableRls("members");

    expect(result).toContain("ALTER TABLE members ENABLE ROW LEVEL SECURITY");
    expect(result).toContain("ALTER TABLE members FORCE ROW LEVEL SECURITY");
  });
});

// ---------------------------------------------------------------------------
// Policy generators
// ---------------------------------------------------------------------------

describe("systemRlsPolicy", () => {
  it("generates USING clause with system_id", () => {
    const result = systemRlsPolicy("members");

    expect(result).toContain("CREATE POLICY");
    expect(result).toContain("current_setting('app.current_system_id')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("system_id =");
  });
});

describe("accountRlsPolicy", () => {
  it("generates USING clause with account_id", () => {
    const result = accountRlsPolicy("sessions");

    expect(result).toContain("CREATE POLICY");
    expect(result).toContain("current_setting('app.current_account_id')");
    expect(result).toContain("USING");
    expect(result).toContain("WITH CHECK");
    expect(result).toContain("account_id =");
  });
});

describe("systemsTableRlsPolicy", () => {
  it("uses id column instead of system_id", () => {
    const result = systemsTableRlsPolicy();

    expect(result).toContain("id =");
    expect(result).not.toContain("system_id =");
    expect(result).toContain("current_setting('app.current_system_id')");
  });
});

describe("accountsTableRlsPolicy", () => {
  it("uses id column instead of account_id", () => {
    const result = accountsTableRlsPolicy();

    expect(result).toContain("id =");
    expect(result).not.toContain("account_id =");
    expect(result).toContain("current_setting('app.current_account_id')");
  });
});

describe("systemPkRlsPolicy", () => {
  it("uses system_id as primary key reference", () => {
    const result = systemPkRlsPolicy("innerworld_canvas");

    expect(result).toContain("CREATE POLICY");
    expect(result).toContain("system_id =");
    expect(result).toContain("current_setting('app.current_system_id')");
  });
});

// ---------------------------------------------------------------------------
// generateRlsStatements
// ---------------------------------------------------------------------------

describe("generateRlsStatements", () => {
  it("returns enable + policy for system-scoped table", () => {
    const stmts = generateRlsStatements("members");

    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[1]).toContain("CREATE POLICY");
  });

  it("returns enable + policy for account-scoped table", () => {
    const stmts = generateRlsStatements("sessions");

    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[1]).toContain("account_id");
  });

  it("returns enable + policy for system-pk table", () => {
    const stmts = generateRlsStatements("innerworld_canvas");

    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("ENABLE ROW LEVEL SECURITY");
    expect(stmts[1]).toContain("system_id =");
  });

  it("returns enable + id-based policy for systems table", () => {
    const stmts = generateRlsStatements("systems");

    expect(stmts).toHaveLength(2);
    expect(stmts[1]).toContain("id =");
    expect(stmts[1]).not.toContain("system_id =");
  });

  it("returns enable + id-based policy for accounts table", () => {
    const stmts = generateRlsStatements("accounts");

    expect(stmts).toHaveLength(2);
    expect(stmts[1]).toContain("id =");
    expect(stmts[1]).not.toContain("account_id =");
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
  it("covers core tables", () => {
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
    ];

    for (const [table, scope] of expected) {
      expect(RLS_TABLE_POLICIES[table]).toBe(scope);
    }
  });

  it("has system-pk scope for innerworld_canvas", () => {
    expect(RLS_TABLE_POLICIES["innerworld_canvas"]).toBe("system-pk");
  });

  it("has valid scope types for all entries", () => {
    const validScopes = new Set<RlsScopeType>(["system", "account", "system-pk", "account-pk"]);

    for (const [table, scope] of Object.entries(RLS_TABLE_POLICIES)) {
      expect(validScopes.has(scope), `Invalid scope for ${table}: ${scope}`).toBe(
        true,
      );
    }
  });
});
