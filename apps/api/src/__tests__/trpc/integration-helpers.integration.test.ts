import { pgInsertAccount, pgInsertSystem } from "@pluralscape/db/test-helpers/pg-helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupRouterIntegration, truncateAll } from "./integration-helpers.js";

import type { RouterIntegrationCtx } from "./integration-helpers.js";

describe("setupRouterIntegration", () => {
  let ctx: RouterIntegrationCtx;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  it("returns a working PGlite-backed db with all tables present", async () => {
    const result = await ctx.pglite.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const tableNames = result.rows.map((r) => r.table_name);
    expect(tableNames).toContain("accounts");
    expect(tableNames).toContain("systems");
    expect(tableNames).toContain("members");
    expect(tableNames).toContain("buckets");
    expect(tableNames).toContain("fronting_sessions");
    expect(tableNames).toContain("system_structure_entities");
  });
});

describe("truncateAll", () => {
  it("removes all rows from accounts and systems but preserves tables", async () => {
    const ctx = await setupRouterIntegration();
    try {
      const accountId = await pgInsertAccount(ctx.db as never);
      await pgInsertSystem(ctx.db as never, accountId);

      const beforeCount = await ctx.pglite.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM accounts`,
      );
      expect(beforeCount.rows[0]?.n).toBe(1);

      await truncateAll(ctx);

      const afterCount = await ctx.pglite.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM accounts`,
      );
      expect(afterCount.rows[0]?.n).toBe(0);

      const tables = await ctx.pglite.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      expect(tables.rows.length).toBeGreaterThan(20);
    } finally {
      await ctx.teardown();
    }
  });
});
