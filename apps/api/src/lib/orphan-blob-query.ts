import { blobMetadata } from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, eq, isNull, lt } from "drizzle-orm";

import type { OrphanBlobQuery } from "@pluralscape/storage/quota";
import type { StorageKey, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Implements OrphanBlobQuery — finds pending blobs (never confirmed)
 * that were created before the cutoff time.
 */
export class OrphanBlobQueryImpl implements OrphanBlobQuery {
  private readonly db: PostgresJsDatabase;

  constructor(db: PostgresJsDatabase) {
    this.db = db;
  }

  async findOrphanedKeys(systemId: SystemId, olderThanMs: number): Promise<readonly StorageKey[]> {
    const cutoff = toUnixMillis(Date.now() - olderThanMs);

    const rows = await this.db
      .select({ storageKey: blobMetadata.storageKey })
      .from(blobMetadata)
      .where(
        and(
          eq(blobMetadata.systemId, systemId),
          isNull(blobMetadata.uploadedAt),
          lt(blobMetadata.createdAt, cutoff),
          eq(blobMetadata.archived, false),
        ),
      );

    // Drop the `ServerInternal<…>` brand on the way to the storage adapter —
    // `StorageKey` is a peer brand that doesn't intersect with `ServerInternal<…>`.
    return rows.map((r) => r.storageKey as string as StorageKey);
  }
}
