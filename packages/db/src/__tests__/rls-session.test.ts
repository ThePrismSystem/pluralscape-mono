import { describe, expect, it } from "vitest";

import {
  setAccountId,
  setAccountIdSql,
  setSystemId,
  setSystemIdSql,
  setTenantContext,
} from "../rls/session.js";

import type { PgExecutor } from "../rls/session.js";
import type { SQL } from "drizzle-orm";

// ---------------------------------------------------------------------------
// SQL fragment generators (pure functions)
// ---------------------------------------------------------------------------

/**
 * Deep-serialize a Drizzle SQL object to extract all embedded strings.
 * Works by JSON.stringify-ing the internal structure.
 */
function serializeSql(sqlObj: SQL): string {
  return JSON.stringify(sqlObj);
}

describe("setSystemIdSql", () => {
  it("returns a SQL object referencing app.current_system_id", () => {
    const result = setSystemIdSql("sys-123");
    const serialized = serializeSql(result);

    expect(serialized).toContain("set_config");
    expect(serialized).toContain("app.current_system_id");
  });
});

describe("setAccountIdSql", () => {
  it("returns a SQL object referencing app.current_account_id", () => {
    const result = setAccountIdSql("acc-456");
    const serialized = serializeSql(result);

    expect(serialized).toContain("set_config");
    expect(serialized).toContain("app.current_account_id");
  });
});

// ---------------------------------------------------------------------------
// Executor-based functions (mock the database)
// ---------------------------------------------------------------------------

function createMockExecutor(): PgExecutor & { callCount: number; lastSql: SQL | null } {
  const state = {
    callCount: 0,
    lastSql: null as SQL | null,
    execute: (query: SQL): Promise<void> => {
      state.callCount++;
      state.lastSql = query;
      return Promise.resolve();
    },
  };
  return state;
}

describe("setSystemId", () => {
  it("calls execute once with system_id GUC", async () => {
    const mock = createMockExecutor();

    await setSystemId(mock, "sys-789");

    expect(mock.callCount).toBe(1);
    const serialized = serializeSql(mock.lastSql as SQL);
    expect(serialized).toContain("app.current_system_id");
  });
});

describe("setAccountId", () => {
  it("calls execute once with account_id GUC", async () => {
    const mock = createMockExecutor();

    await setAccountId(mock, "acc-012");

    expect(mock.callCount).toBe(1);
    const serialized = serializeSql(mock.lastSql as SQL);
    expect(serialized).toContain("app.current_account_id");
  });
});

describe("setTenantContext", () => {
  it("calls execute once (single round-trip for both system + account)", async () => {
    const mock = createMockExecutor();

    await setTenantContext(mock, { systemId: "sys-1", accountId: "acc-2" });

    expect(mock.callCount).toBe(1);
    const serialized = serializeSql(mock.lastSql as SQL);
    expect(serialized).toContain("app.current_system_id");
    expect(serialized).toContain("app.current_account_id");
  });
});
