import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toBlobResult } from "./internal.js";

import type { BlobResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BlobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function getBlob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  blobId: BlobId,
  auth: AuthContext,
): Promise<BlobResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
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
  });
}
