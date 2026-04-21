import { relationships } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateRelationshipBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  relationshipId: RelationshipId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateRelationshipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(relationships)
      .set({
        type: parsed.type,
        bidirectional: parsed.bidirectional,
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${relationships.version} + 1`,
      })
      .where(
        and(
          eq(relationships.id, relationshipId),
          eq(relationships.systemId, systemId),
          eq(relationships.version, parsed.version),
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
