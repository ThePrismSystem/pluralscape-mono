import {
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityTypes,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toStructureEntityResult } from "./internal.js";

import type { StructureEntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
} from "@pluralscape/types";
import type { CreateStructureEntityBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createStructureEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateStructureEntityBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureEntityResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const entityId = brandId<SystemStructureEntityId>(createId(ID_PREFIXES.structureEntity));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [entityType] = await tx
      .select({ id: systemStructureEntityTypes.id })
      .from(systemStructureEntityTypes)
      .where(
        and(
          eq(systemStructureEntityTypes.id, body.structureEntityTypeId),
          eq(systemStructureEntityTypes.systemId, systemId),
          eq(systemStructureEntityTypes.archived, false),
        ),
      )
      .limit(1);

    if (!entityType) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity type not found");
    }

    const [row] = await tx
      .insert(systemStructureEntities)
      .values({
        id: entityId,
        systemId,
        entityTypeId: body.structureEntityTypeId,
        sortOrder: body.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create structure entity — INSERT returned no rows");
    }

    if (body.parentEntityId !== null) {
      const linkId = brandId<SystemStructureEntityLinkId>(
        createId(ID_PREFIXES.structureEntityLink),
      );
      await tx.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId,
        parentEntityId: body.parentEntityId,
        sortOrder: 0,
        createdAt: timestamp,
      });
    }

    await audit(tx, {
      eventType: "structure-entity.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity created",
      systemId,
    });

    return toStructureEntityResult(row);
  });
}
