import { blobMetadata } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { ConfirmUploadBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toBlobResult } from "./internal.js";

import type { BlobResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function confirmUpload(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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
  const thumbnailOfBlobIdBranded = thumbnailOfBlobId ? brandId<BlobId>(thumbnailOfBlobId) : null;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
      .for("update")
      .limit(1);

    if (!pending) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Blob not found");
    }

    // If already confirmed, return idempotently
    if (pending.uploadedAt !== null) {
      return toBlobResult(pending);
    }

    // Validate thumbnailOfBlobId if provided
    if (thumbnailOfBlobIdBranded) {
      const [target] = await tx
        .select({ id: blobMetadata.id })
        .from(blobMetadata)
        .where(
          and(
            eq(blobMetadata.id, thumbnailOfBlobIdBranded),
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
        thumbnailOfBlobId: thumbnailOfBlobIdBranded,
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
