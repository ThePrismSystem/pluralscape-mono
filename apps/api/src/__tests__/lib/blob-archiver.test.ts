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

  it("sets archived flag via update...set...where chain", async () => {
    const { db, chain } = mockDb();
    // update().set().where() — where is terminal
    chain.where.mockResolvedValueOnce(undefined);

    const archiver = new BlobArchiverImpl(db);
    await archiver.archiveByStorageKey("sk_test-key" as StorageKey);

    expect(chain.update).toHaveBeenCalledOnce();
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, archivedAt: 1_700_000_000_000 }),
    );
    expect(chain.where).toHaveBeenCalledOnce();
  });

  it("is idempotent: already-archived blob succeeds without error", async () => {
    const { db, chain } = mockDb();
    // When already archived, the WHERE clause (archived=false) matches no rows,
    // but the update still resolves without error
    chain.where.mockResolvedValueOnce(undefined);

    const archiver = new BlobArchiverImpl(db);

    await expect(
      archiver.archiveByStorageKey("sk_already-archived" as StorageKey),
    ).resolves.toBeUndefined();
  });
});
