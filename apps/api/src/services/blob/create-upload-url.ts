import { blobMetadata } from "@pluralscape/db/pg";
import { QuotaExceededError } from "@pluralscape/storage";
import {
  brandId,
  BLOB_SIZE_LIMITS,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
} from "@pluralscape/types";
import { CreateUploadUrlBodySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST, HTTP_CONTENT_TOO_LARGE } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { PRESIGNED_UPLOAD_TTL_MS } from "../../routes/blobs/blobs.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { BlobQuotaService } from "@pluralscape/storage/quota";
import type { BlobId, StorageKey, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface UploadUrlResult {
  readonly blobId: BlobId;
  readonly uploadUrl: string;
  readonly expiresAt: UnixMillis;
  /** Form fields required for POST-based presigned uploads. */
  readonly fields?: Readonly<Record<string, string>>;
}

export async function createUploadUrl(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
  quotaService: BlobQuotaService,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<UploadUrlResult> {
  assertSystemOwnership(systemId, auth);

  const result = CreateUploadUrlBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { purpose, mimeType, sizeBytes, encryptionTier } = result.data;

  // Check per-purpose size limit
  const maxSize = BLOB_SIZE_LIMITS[purpose];
  if (sizeBytes > maxSize) {
    throw new ApiHttpError(
      HTTP_CONTENT_TOO_LARGE,
      "BLOB_TOO_LARGE",
      `File size exceeds maximum of ${String(maxSize)} bytes for purpose "${purpose}"`,
    );
  }

  // Quota check
  try {
    await quotaService.assertQuota(systemId, sizeBytes);
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      throw new ApiHttpError(HTTP_CONTENT_TOO_LARGE, "QUOTA_EXCEEDED", error.message);
    }
    throw error;
  }

  const blobId = brandId<BlobId>(createId(ID_PREFIXES.blob));
  const storageKey = `${systemId}/${blobId}` as StorageKey;
  const timestamp = now();
  const expiresAt = toUnixMillis(timestamp + PRESIGNED_UPLOAD_TTL_MS);

  // DB insert + audit inside transaction; S3 presigned URL outside to avoid
  // holding a DB connection open during external network I/O.
  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await tx.insert(blobMetadata).values({
      id: blobId,
      systemId,
      storageKey,
      mimeType,
      sizeBytes,
      encryptionTier,
      purpose,
      checksum: null,
      createdAt: timestamp,
      uploadedAt: null,
      expiresAt,
    });

    await audit(tx, {
      eventType: "blob.upload-requested",
      actor: { kind: "account", id: auth.accountId },
      detail: `Upload requested: ${purpose} (${String(sizeBytes)} bytes)`,
      systemId,
    });
  });

  // Generate presigned URL outside the transaction
  const presigned = await storageAdapter.generatePresignedUploadUrl({
    storageKey,
    mimeType,
    sizeBytes,
    expiresInMs: PRESIGNED_UPLOAD_TTL_MS,
  });

  if (!presigned.supported) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Presigned uploads not supported by storage backend",
    );
  }

  return {
    blobId,
    uploadUrl: presigned.url,
    expiresAt: presigned.expiresAt,
    ...(presigned.fields ? { fields: presigned.fields } : {}),
  };
}
