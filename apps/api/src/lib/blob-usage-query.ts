import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, isNotNull, sum } from "drizzle-orm";

import type { BlobUsageQuery } from "@pluralscape/storage/quota";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Implements BlobUsageQuery using Drizzle queries against blob_metadata.
 * Returns total bytes used by non-archived, confirmed blobs for a system.
 */
export class BlobUsageQueryImpl implements BlobUsageQuery {
  private readonly db: PostgresJsDatabase;

  constructor(db: PostgresJsDatabase) {
    this.db = db;
  }

  async getUsedBytes(systemId: SystemId): Promise<number> {
    const [result] = await this.db
      .select({ total: sum(blobMetadata.sizeBytes) })
      .from(blobMetadata)
      .where(
        and(
          eq(blobMetadata.systemId, systemId),
          eq(blobMetadata.archived, false),
          isNotNull(blobMetadata.uploadedAt),
        ),
      );

    return Number(result?.total ?? 0);
  }
}
