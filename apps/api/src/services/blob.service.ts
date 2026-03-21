import { blobMetadata } from "@pluralscape/db/pg";
import { QuotaExceededError } from "@pluralscape/storage";
import { BLOB_SIZE_LIMITS, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { ConfirmUploadBodySchema, CreateUploadUrlBodySchema } from "@pluralscape/validation";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONTENT_TOO_LARGE, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_BLOB_LIMIT,
  MAX_BLOB_LIMIT,
  PRESIGNED_UPLOAD_TTL_MS,
} from "../routes/blobs/blobs.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { BlobQuotaService } from "@pluralscape/storage/quota";
import type {
  BlobId,
  BlobPurpose,
  PaginatedResult,
  StorageKey,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface UploadUrlResult {
  readonly blobId: BlobId;
  readonly uploadUrl: string;
  readonly expiresAt: UnixMillis;
}

export interface BlobResult {
  readonly id: BlobId;
  readonly systemId: SystemId;
  readonly purpose: BlobPurpose;
  readonly mimeType: string | null;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly uploadedAt: UnixMillis;
  readonly thumbnailOfBlobId: BlobId | null;
}

export interface DownloadUrlResult {
  readonly blobId: BlobId;
  readonly downloadUrl: string;
  readonly expiresAt: UnixMillis;
}

// ── CREATE UPLOAD URL ───────────────────────────────────────────────

export async function createUploadUrl(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
  quotaService: BlobQuotaService,
  systemId: SystemId,
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

  const blobId = createId(ID_PREFIXES.blob);
  const storageKey = `${systemId}/${blobId}` as StorageKey;
  const timestamp = now();
  const expiresAt = toUnixMillis(timestamp + PRESIGNED_UPLOAD_TTL_MS);

  // Insert pending row
  await db.insert(blobMetadata).values({
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

  // Generate presigned URL
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

  await audit(db, {
    eventType: "blob.upload-requested",
    actor: { kind: "account", id: auth.accountId },
    detail: `Upload requested: ${purpose} (${String(sizeBytes)} bytes)`,
    systemId,
  });

  return {
    blobId: blobId as BlobId,
    uploadUrl: presigned.url,
    expiresAt: presigned.expiresAt,
  };
}

// ── CONFIRM UPLOAD ──────────────────────────────────────────────────

export async function confirmUpload(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BlobResult> {
  assertSystemOwnership(systemId, auth);

  const result = ConfirmUploadBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const { checksum, thumbnailOfBlobId } = result.data;
  const timestamp = now();

  return db.transaction(async (tx) => {
    // Find pending blob
    const [pending] = await tx
      .select()
      .from(blobMetadata)
      .where(
        and(
          eq(blobMetadata.id, blobId),
          eq(blobMetadata.systemId, systemId),
          eq(blobMetadata.archived, false),
        ),
      )
      .limit(1);

    if (!pending) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Blob not found");
    }

    // If already confirmed, return idempotently
    if (pending.uploadedAt !== null) {
      return toBlobResult(pending);
    }

    // Validate thumbnailOfBlobId if provided
    if (thumbnailOfBlobId) {
      const [target] = await tx
        .select({ id: blobMetadata.id })
        .from(blobMetadata)
        .where(
          and(
            eq(blobMetadata.id, thumbnailOfBlobId),
            eq(blobMetadata.systemId, systemId),
            sql`${blobMetadata.uploadedAt} IS NOT NULL`,
            eq(blobMetadata.archived, false),
          ),
        )
        .limit(1);

      if (!target) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Thumbnail target blob not found");
      }
    }

    const [row] = await tx
      .update(blobMetadata)
      .set({
        checksum,
        uploadedAt: timestamp,
        expiresAt: null,
        thumbnailOfBlobId: thumbnailOfBlobId ?? null,
      })
      .where(and(eq(blobMetadata.id, blobId), eq(blobMetadata.systemId, systemId)))
      .returning();

    if (!row) {
      throw new Error("Failed to confirm upload — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "blob.confirmed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Upload confirmed",
      systemId,
    });

    return toBlobResult(row);
  });
}

// ── GET BLOB ────────────────────────────────────────────────────────

export async function getBlob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
): Promise<BlobResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select()
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

  return toBlobResult(row);
}

// ── LIST BLOBS ──────────────────────────────────────────────────────

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
  const conditions = [
    eq(blobMetadata.systemId, systemId),
    sql`${blobMetadata.uploadedAt} IS NOT NULL`,
  ];

  if (!opts?.includeArchived) {
    conditions.push(eq(blobMetadata.archived, false));
  }

  if (opts?.cursor) {
    conditions.push(gt(blobMetadata.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(blobMetadata)
    .where(and(...conditions))
    .orderBy(blobMetadata.id)
    .limit(limit + 1);

  return buildPaginatedResult(rows, limit, toBlobResult);
}

// ── DOWNLOAD URL ────────────────────────────────────────────────────

export async function getDownloadUrl(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
): Promise<DownloadUrlResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
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

  const presigned = await storageAdapter.generatePresignedDownloadUrl({
    storageKey: row.storageKey as StorageKey,
  });

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

// ── ARCHIVE BLOB ────────────────────────────────────────────────────

export async function archiveBlob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: blobMetadata.id })
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Blob not found");
    }

    await tx
      .update(blobMetadata)
      .set({ archived: true, archivedAt: timestamp })
      .where(and(eq(blobMetadata.id, blobId), eq(blobMetadata.systemId, systemId)));

    await audit(tx, {
      eventType: "blob.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Blob archived",
      systemId,
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

function toBlobResult(row: {
  id: string;
  systemId: string;
  purpose: string;
  mimeType: string | null;
  sizeBytes: number;
  checksum: string | null;
  uploadedAt: number | null;
  thumbnailOfBlobId: string | null;
}): BlobResult {
  return {
    id: row.id as BlobId,
    systemId: row.systemId as SystemId,
    purpose: row.purpose as BlobPurpose,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum ?? "",
    uploadedAt: toUnixMillis(row.uploadedAt ?? 0),
    thumbnailOfBlobId: row.thumbnailOfBlobId as BlobId | null,
  };
}
