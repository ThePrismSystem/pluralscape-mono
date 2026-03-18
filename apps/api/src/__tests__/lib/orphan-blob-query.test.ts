import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, isNull, lt } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrphanBlobQueryImpl } from "../../lib/orphan-blob-query.js";
import { mockDb } from "../helpers/mock-db.js";

import type { SystemId } from "@pluralscape/types";

const SYSTEM_ID = "sys_test-system" as SystemId;
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
});
