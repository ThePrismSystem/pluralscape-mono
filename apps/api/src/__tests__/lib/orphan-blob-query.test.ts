import { blobMetadata } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, isNull, lt } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrphanBlobQueryImpl } from "../../lib/orphan-blob-query.js";
import { mockDb } from "../helpers/mock-db.js";

import type { SystemId } from "@pluralscape/types";

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ONE_HOUR_MS = 3_600_000;

describe("OrphanBlobQueryImpl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns storage keys of old pending blobs with correct query predicates", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([
      { storageKey: "sk_orphan-1" },
      { storageKey: "sk_orphan-2" },
    ]);

    const query = new OrphanBlobQueryImpl(db);
    const result = await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    expect(result).toEqual(["sk_orphan-1", "sk_orphan-2"]);

    expect(chain.select).toHaveBeenCalledWith({ storageKey: blobMetadata.storageKey });
    expect(chain.from).toHaveBeenCalledWith(blobMetadata);
    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(blobMetadata.systemId, SYSTEM_ID),
        isNull(blobMetadata.uploadedAt),
        lt(blobMetadata.createdAt, now - ONE_HOUR_MS),
        eq(blobMetadata.archived, false),
      ),
    );
  });

  it("returns empty array when no orphans exist", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([]);

    const query = new OrphanBlobQueryImpl(db);
    const result = await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    expect(result).toEqual([]);
  });

  it("computes cutoff from Date.now minus olderThanMs", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([]);

    const customMs = 7_200_000; // 2 hours
    const query = new OrphanBlobQueryImpl(db);
    await query.findOrphanedKeys(SYSTEM_ID, customMs);

    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(blobMetadata.systemId, SYSTEM_ID),
        isNull(blobMetadata.uploadedAt),
        lt(blobMetadata.createdAt, now - customMs),
        eq(blobMetadata.archived, false),
      ),
    );
  });

  it("returns a single orphan key", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([{ storageKey: "sk_only-one" }]);

    const query = new OrphanBlobQueryImpl(db);
    const result = await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    expect(result).toEqual(["sk_only-one"]);
  });

  it("propagates database errors", async () => {
    const { db, chain } = mockDb();
    chain.where.mockRejectedValueOnce(new Error("database unavailable"));

    const query = new OrphanBlobQueryImpl(db);
    await expect(query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS)).rejects.toThrow(
      "database unavailable",
    );
  });
});
