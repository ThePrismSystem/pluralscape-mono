import { systemStructureEntities } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateStructureEntityBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../../lib/occ-update.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toStructureEntityResult } from "./internal.js";

import type { StructureEntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateStructureEntityBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemStructureEntities)
      .set({
        encryptedData: blob,
        sortOrder: parsed.data.sortOrder,
        updatedAt: timestamp,
        version: sql`${systemStructureEntities.version} + 1`,
      })
      .where(
        and(
          eq(systemStructureEntities.id, entityId),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.version, parsed.data.version),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: systemStructureEntities.id })
          .from(systemStructureEntities)
          .where(
            and(
              eq(systemStructureEntities.id, entityId),
              eq(systemStructureEntities.systemId, systemId),
              eq(systemStructureEntities.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Structure entity",
    );

    await audit(tx, {
      eventType: "structure-entity.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity updated",
      systemId,
    });

    return toStructureEntityResult(row);
  });
}
