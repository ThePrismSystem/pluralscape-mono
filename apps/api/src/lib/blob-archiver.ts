import { blobMetadata } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import type { BlobArchiver } from "@pluralscape/storage/quota";
import type { ServerInternal, StorageKey } from "@pluralscape/types";
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
      .where(
        and(
          // The storage_key column is branded `ServerInternal<string>` for
          // wire-strip; the input is a `StorageKey` (a peer brand). Drop
          // through `string` to align both for the typed `eq()` overload.
          eq(blobMetadata.storageKey, storageKey as string as ServerInternal<string>),
          eq(blobMetadata.archived, false),
        ),
      );
  }
}
