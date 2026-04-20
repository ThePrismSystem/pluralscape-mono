import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupRouterIntegration } from "./integration-helpers.js";

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
