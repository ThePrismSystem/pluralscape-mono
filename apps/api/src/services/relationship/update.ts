import { relationships } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toRelationshipResult } from "./internal.js";

import type { RelationshipResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { RelationshipId, SystemId } from "@pluralscape/types";
import type { UpdateRelationshipBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  body: z.infer<typeof UpdateRelationshipBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(relationships)
      .set({
        type: body.type,
        bidirectional: body.bidirectional,
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${relationships.version} + 1`,
      })
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.version, body.version),
          eq(relationships.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: relationships.id })
          .from(relationships)
          .where(
            and(
              eq(relationships.id, relationshipId),
              eq(relationships.systemId, systemId),
              eq(relationships.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Relationship",
    );

    await audit(tx, {
      eventType: "relationship.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship updated",
      systemId,
    });

    return toRelationshipResult(row);
  });
}
