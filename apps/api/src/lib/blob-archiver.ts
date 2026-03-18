import { blobMetadata } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import type { BlobArchiver } from "@pluralscape/storage/quota";
import type { StorageKey } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Implements BlobArchiver — marks blob metadata records as archived by storage key.
 * Idempotent: archiving an already-archived record succeeds without error.
 */
export class BlobArchiverImpl implements BlobArchiver {
  private readonly db: PostgresJsDatabase;

  constructor(db: PostgresJsDatabase) {
    this.db = db;
  }

  async archiveByStorageKey(storageKey: StorageKey): Promise<void> {
    const timestamp = now();
    await this.db
      .update(blobMetadata)
      .set({ archived: true, archivedAt: timestamp })
      .where(and(eq(blobMetadata.storageKey, storageKey), eq(blobMetadata.archived, false)));
  }
}
