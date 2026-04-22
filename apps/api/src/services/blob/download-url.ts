import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { BlobId, StorageKey, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface DownloadUrlResult {
  readonly blobId: BlobId;
  readonly downloadUrl: string;
  readonly expiresAt: UnixMillis;
}

export async function getDownloadUrl(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
): Promise<DownloadUrlResult> {
  assertSystemOwnership(systemId, auth);

  // Fetch storage key inside read context; generate presigned URL outside
  // to avoid holding a DB connection open during external S3 I/O.
  const storageKey = await withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select({ storageKey: blobMetadata.storageKey })
      .from(blobMetadata)
      .where(
        and(
          eq(blobMetadata.id, blobId),
          eq(blobMetadata.systemId, systemId),
          sql`${blobMetadata.uploadedAt} IS NOT NULL`,
          eq(blobMetadata.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Blob not found");
    }

    return row.storageKey as StorageKey;
  });

  const presigned = await storageAdapter.generatePresignedDownloadUrl({ storageKey });

  if (!presigned.supported) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Presigned downloads not supported by storage backend",
    );
  }

  return {
    blobId,
    downloadUrl: presigned.url,
    expiresAt: presigned.expiresAt,
  };
}
