import { innerworldEntities } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateEntityBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../../lib/occ-update.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toEntityResult } from "./internal.js";

import type { EntityResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldEntityId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: InnerWorldEntityId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<EntityResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateEntityBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(innerworldEntities)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${innerworldEntities.version} + 1`,
      })
      .where(
        and(
          eq(innerworldEntities.id, entityId),
          eq(innerworldEntities.systemId, systemId),
          eq(innerworldEntities.version, parsed.version),
          eq(innerworldEntities.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: innerworldEntities.id })
          .from(innerworldEntities)
          .where(
            and(
              eq(innerworldEntities.id, entityId),
              eq(innerworldEntities.systemId, systemId),
              eq(innerworldEntities.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Entity",
    );

    await audit(tx, {
      eventType: "innerworld-entity.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Entity updated",
      systemId,
    });

    return toEntityResult(row);
  });
}
