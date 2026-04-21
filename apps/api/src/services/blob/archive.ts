import { blobMetadata } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveBlob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
