import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlobArchiverImpl } from "../../lib/blob-archiver.js";
import { mockDb } from "../helpers/mock-db.js";

import type { StorageKey } from "@pluralscape/types";

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    now: vi.fn().mockReturnValue(1_700_000_000_000),
  };
});

describe("BlobArchiverImpl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets archived flag via update...set...where chain with correct predicates", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce(undefined);

    const storageKey = "sk_test-key" as StorageKey;
    const archiver = new BlobArchiverImpl(db);
    await archiver.archiveByStorageKey(storageKey);

    expect(chain.update).toHaveBeenCalledWith(blobMetadata);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, archivedAt: 1_700_000_000_000 }),
    );
    expect(chain.where).toHaveBeenCalledWith(
      and(eq(blobMetadata.storageKey, storageKey), eq(blobMetadata.archived, false)),
    );
  });

  it("is idempotent — succeeds when no rows match (already archived)", async () => {
    const { db, chain } = mockDb();
    // where() resolving to undefined simulates zero rows updated
    chain.where.mockResolvedValueOnce(undefined);

    const archiver = new BlobArchiverImpl(db);
    await expect(
      archiver.archiveByStorageKey("sk_already-archived" as StorageKey),
    ).resolves.toBeUndefined();
  });

  it("propagates database errors", async () => {
    const { db, chain } = mockDb();
    chain.where.mockRejectedValueOnce(new Error("connection lost"));

    const archiver = new BlobArchiverImpl(db);
    await expect(archiver.archiveByStorageKey("sk_fail" as StorageKey)).rejects.toThrow(
      "connection lost",
    );
  });
});
