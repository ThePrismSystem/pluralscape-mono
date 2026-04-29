import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { CreateStructureEntityTypeBodySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toEntityTypeResult, type EntityTypeResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createEntityType(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityTypeResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateStructureEntityTypeBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const entityTypeId = brandId<SystemStructureEntityTypeId>(
    createId(ID_PREFIXES.structureEntityType),
  );
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemStructureEntityTypes)
      .values({
        id: entityTypeId,
        systemId,
        sortOrder: parsed.data.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity type — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "structure-entity-type.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Structure entity type created",
      systemId,
    });

    return toEntityTypeResult(row);
  });
}
