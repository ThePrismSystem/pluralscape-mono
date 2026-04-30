import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

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
import type { UpdateStructureEntityTypeBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityTypeId: SystemStructureEntityTypeId,
  body: z.infer<typeof UpdateStructureEntityTypeBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(systemStructureEntityTypes)
      .set({
        encryptedData: blob,
        sortOrder: body.sortOrder,
        updatedAt: timestamp,
        version: sql`${systemStructureEntityTypes.version} + 1`,
      })
      .where(
        and(
          eq(systemStructureEntityTypes.id, entityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.version, body.version),
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
