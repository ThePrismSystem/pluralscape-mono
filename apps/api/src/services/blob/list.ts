import { blobMetadata } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, gt, sql } from "drizzle-orm";

import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_BLOB_LIMIT, MAX_BLOB_LIMIT } from "../../routes/blobs/blobs.constants.js";

import { toBlobResult } from "./internal.js";

import type { BlobResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listBlobs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<BlobResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_BLOB_LIMIT, MAX_BLOB_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [
      eq(blobMetadata.systemId, systemId),
      sql`${blobMetadata.uploadedAt} IS NOT NULL`,
    ];

    if (!opts?.includeArchived) {
      conditions.push(eq(blobMetadata.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(blobMetadata.id, brandId<BlobId>(opts.cursor)));
    }

    const rows = await tx
      .select()
      .from(blobMetadata)
      .where(and(...conditions))
      .orderBy(blobMetadata.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toBlobResult);
  });
}
