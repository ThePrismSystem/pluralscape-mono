import { afterEach, describe, expect, it, vi } from "vitest";

import { BlobUsageQueryImpl } from "../../lib/blob-usage-query.js";
import { mockDb } from "../helpers/mock-db.js";

import type { SystemId } from "@pluralscape/types";

const SYSTEM_ID = "sys_test-system" as SystemId;

describe("BlobUsageQueryImpl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sum of sizeBytes for a system", async () => {
    const { db, chain } = mockDb();
    // The query uses select().from().where() — where is terminal here (no .limit)
    chain.where.mockResolvedValueOnce([{ total: "12345" }]);

    const query = new BlobUsageQueryImpl(db);
    const result = await query.getUsedBytes(SYSTEM_ID);

    expect(result).toBe(12345);
  });

  it("returns 0 when no blobs exist for the system", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([{ total: null }]);

    const query = new BlobUsageQueryImpl(db);
    const result = await query.getUsedBytes(SYSTEM_ID);

    expect(result).toBe(0);
  });

  it("returns 0 when query returns empty result", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([]);

    const query = new BlobUsageQueryImpl(db);
    const result = await query.getUsedBytes(SYSTEM_ID);

    expect(result).toBe(0);
  });
});
