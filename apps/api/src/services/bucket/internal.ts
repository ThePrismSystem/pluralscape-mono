import { buckets } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type {
  BucketId,
  EncryptedWire,
  PrivacyBucketServerMetadata,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export type BucketResult = EncryptedWire<PrivacyBucketServerMetadata>;

export interface ListBucketOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly archivedOnly?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function toBucketResult(row: typeof buckets.$inferSelect): BucketResult {
  return {
    id: brandId<BucketId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/** Assert a non-archived bucket exists for the given system. Throws NOT_FOUND if missing. */
export async function assertBucketExists(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
): Promise<void> {
  const [existing] = await tx
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      and(eq(buckets.id, bucketId), eq(buckets.systemId, systemId), eq(buckets.archived, false)),
    )
    .limit(1);

  if (!existing) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Bucket not found");
  }
}

// ── Lifecycle config (shared by archive + restore) ──────────────────

export const BUCKET_LIFECYCLE: ArchivableEntityConfig<BucketId> = {
  table: buckets,
  columns: buckets,
  entityName: "Bucket",
  archiveEvent: "bucket.archived" as const,
  restoreEvent: "bucket.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.archived", { bucketId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.restored", { bucketId: eid }),
};
