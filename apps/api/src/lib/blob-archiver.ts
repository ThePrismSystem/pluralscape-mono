import { blobMetadata } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { asInternalStorageKey } from "./storage-key-brand.js";

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
      .where(
        and(
          // The storage_key column is branded `ServerInternal<string>` for
          // wire-strip; the input is a `StorageKey` (a peer brand). Re-tag
          // through the shared helper so the typed `eq()` overload accepts
          // the value with a single assertion inside the helper.
          eq(blobMetadata.storageKey, asInternalStorageKey(storageKey)),
          eq(blobMetadata.archived, false),
        ),
      );
  }
}
