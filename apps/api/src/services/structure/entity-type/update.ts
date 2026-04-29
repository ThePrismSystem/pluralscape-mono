import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateStructureEntityTypeBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../../lib/occ-update.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toEntityTypeResult, type EntityTypeResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateStructureEntityTypeBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemStructureEntityTypes)
      .set({
        encryptedData: blob,
        sortOrder: parsed.data.sortOrder,
        updatedAt: timestamp,
        version: sql`${systemStructureEntityTypes.version} + 1`,
      })
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.version, parsed.data.version),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: systemStructureEntityTypes.id })
          .from(systemStructureEntityTypes)
          .where(
            and(
              eq(systemStructureEntityTypes.id, entityTypeId),
              eq(systemStructureEntityTypes.systemId, systemId),
              eq(systemStructureEntityTypes.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Structure entity type",
    );

    await audit(tx, {
      eventType: "structure-entity-type.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type updated",
      systemId,
    });

    return toEntityTypeResult(row);
  });
}
