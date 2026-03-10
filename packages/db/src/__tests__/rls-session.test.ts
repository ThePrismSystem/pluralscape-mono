import { describe, expect, it } from "vitest";

import {
  setAccountId,
  setAccountIdSql,
  setSystemId,
  setSystemIdSql,
  setTenantContext,
} from "../rls/session.js";

import type { PgExecutor } from "../rls/session.js";

// ---------------------------------------------------------------------------
// SQL fragment generators (pure functions)
// ---------------------------------------------------------------------------

describe("setSystemIdSql", () => {
  it("returns a SQL object", () => {
    const result = setSystemIdSql("sys-123");

    expect(result).toBeDefined();
    expect(result).toBeTruthy();
  });
});

describe("setAccountIdSql", () => {
  it("returns a SQL object", () => {
    const result = setAccountIdSql("acc-456");

    expect(result).toBeDefined();
    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Executor-based functions (mock the database)
// ---------------------------------------------------------------------------

function createMockExecutor(): PgExecutor & { callCount: number } {
  const state = { callCount: 0, execute: (): Promise<void> => Promise.resolve() };
  state.execute = () => {
    state.callCount++;
    return Promise.resolve();
  };
  return state;
}

describe("setSystemId", () => {
  it("calls execute once", async () => {
    const mock = createMockExecutor();

    await setSystemId(mock, "sys-789");

    expect(mock.callCount).toBe(1);
  });
});

describe("setAccountId", () => {
  it("calls execute once", async () => {
    const mock = createMockExecutor();

    await setAccountId(mock, "acc-012");

    expect(mock.callCount).toBe(1);
  });
});

describe("setTenantContext", () => {
  it("calls execute twice (system + account)", async () => {
    const mock = createMockExecutor();

    await setTenantContext(mock, { systemId: "sys-1", accountId: "acc-2" });

    expect(mock.callCount).toBe(2);
  });
});
