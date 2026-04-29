import { innerworldEntities, innerworldRegions, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { CreateEntityBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_INNERWORLD_ENTITIES_PER_SYSTEM } from "../../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toEntityResult } from "./internal.js";

import type { EntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldEntityId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateEntityBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const entityId = brandId<InnerWorldEntityId>(createId(ID_PREFIXES.innerWorldEntity));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system entity quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(innerworldEntities)
      .where(
        and(eq(innerworldEntities.systemId, systemId), eq(innerworldEntities.archived, false)),
      );

    if ((existingCount?.count ?? 0) >= MAX_INNERWORLD_ENTITIES_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_INNERWORLD_ENTITIES_PER_SYSTEM)} innerworld entities per system`,
      );
    }

    // Validate regionId exists in same system if provided
    const regionId = body.regionId ?? null;
    if (regionId !== null) {
      const [region] = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, regionId),
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        )
        .limit(1);

      if (!region) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Region not found");
      }
    }

    const [row] = await tx
      .insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        regionId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create entity — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "innerworld-entity.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity created",
      systemId,
    });

    return toEntityResult(row);
  });
}
