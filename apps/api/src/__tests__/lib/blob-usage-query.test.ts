import { blobMetadata } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, isNotNull, sum } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlobUsageQueryImpl } from "../../lib/blob-usage-query.js";
import { mockDb } from "../helpers/mock-db.js";

import type { SystemId } from "@pluralscape/types";

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

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

  it("queries with correct predicates (non-archived, confirmed blobs)", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([{ total: "500" }]);

    const query = new BlobUsageQueryImpl(db);
    await query.getUsedBytes(SYSTEM_ID);

    expect(chain.select).toHaveBeenCalledWith({ total: sum(blobMetadata.sizeBytes) });
    expect(chain.from).toHaveBeenCalledWith(blobMetadata);
    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(blobMetadata.systemId, SYSTEM_ID),
        eq(blobMetadata.archived, false),
        isNotNull(blobMetadata.uploadedAt),
      ),
    );
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

  it("coerces string total to number", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([{ total: "999999" }]);

    const query = new BlobUsageQueryImpl(db);
    const result = await query.getUsedBytes(SYSTEM_ID);

    expect(result).toBe(999_999);
    expect(typeof result).toBe("number");
  });

  it("propagates database errors", async () => {
    const { db, chain } = mockDb();
    chain.where.mockRejectedValueOnce(new Error("query timeout"));

    const query = new BlobUsageQueryImpl(db);
    await expect(query.getUsedBytes(SYSTEM_ID)).rejects.toThrow("query timeout");
  });
});
