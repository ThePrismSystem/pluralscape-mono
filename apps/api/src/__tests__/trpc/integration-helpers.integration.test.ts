import { pgInsertAccount, pgInsertSystem } from "@pluralscape/db/test-helpers/pg-helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { router as makeRouter, publicProcedure } from "../../trpc/trpc.js";

import {
  seedAccountAndSystem,
  seedSecondTenant,
  setupRouterIntegration,
  truncateAll,
} from "./integration-helpers.js";
import { makeIntegrationCallerFactory } from "./test-helpers.js";

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

describe("makeIntegrationCallerFactory", () => {
  it("creates a caller backed by a real TRPCContext that exposes the db", async () => {
    const ctx = await setupRouterIntegration();
    try {
      const probeRouter = makeRouter({
        ping: publicProcedure.query(() => "pong"),
      });
      const makeCaller = makeIntegrationCallerFactory({ probe: probeRouter }, ctx.db);
      const caller = makeCaller(null);
      const result = await caller.probe.ping();
      expect(result).toBe("pong");
    } finally {
      await ctx.teardown();
    }
  });
});

describe("seedAccountAndSystem", () => {
  it("inserts an account + system and returns a usable AuthContext", async () => {
    const ctx = await setupRouterIntegration();
    try {
      const tenant = await seedAccountAndSystem(ctx.db);
      expect(tenant.accountId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(tenant.systemId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(tenant.auth.accountId).toBe(tenant.accountId);
      expect(tenant.auth.systemId).toBe(tenant.systemId);
      expect(tenant.auth.ownedSystemIds.has(tenant.systemId)).toBe(true);
    } finally {
      await ctx.teardown();
    }
  });

  it("seedSecondTenant creates a distinct tenant", async () => {
    const ctx = await setupRouterIntegration();
    try {
      const a = await seedAccountAndSystem(ctx.db);
      const b = await seedSecondTenant(ctx.db);
      expect(a.accountId).not.toBe(b.accountId);
      expect(a.systemId).not.toBe(b.systemId);
    } finally {
      await ctx.teardown();
    }
  });
});
