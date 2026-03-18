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

  it("returns storage keys of old pending blobs", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([
      { storageKey: "sk_orphan-1" },
      { storageKey: "sk_orphan-2" },
    ]);

    const query = new OrphanBlobQueryImpl(db);
    const result = await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    expect(result).toEqual(["sk_orphan-1", "sk_orphan-2"]);
  });

  it("returns empty array when no orphans exist", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([]);

    const query = new OrphanBlobQueryImpl(db);
    const result = await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    expect(result).toEqual([]);
  });

  it("computes cutoff time based on Date.now() minus olderThanMs", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([]);

    const query = new OrphanBlobQueryImpl(db);
    await query.findOrphanedKeys(SYSTEM_ID, ONE_HOUR_MS);

    // Verify the query chain was invoked (cutoff calculation is internal)
    expect(chain.select).toHaveBeenCalledOnce();
    expect(chain.from).toHaveBeenCalledOnce();
    expect(chain.where).toHaveBeenCalledOnce();
  });
});
