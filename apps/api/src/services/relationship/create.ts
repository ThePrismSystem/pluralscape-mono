import { members, relationships } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { and, eq, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toRelationshipResult } from "./internal.js";

import type { RelationshipResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { MemberId, RelationshipId, SystemId } from "@pluralscape/types";
import type { CreateRelationshipBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateRelationshipBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  if (!body.sourceMemberId || !body.targetMemberId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "sourceMemberId and targetMemberId are required",
    );
  }

  const relationshipId = brandId<RelationshipId>(createId(ID_PREFIXES.relationship));
  const timestamp = now();
  const sourceMemberId = brandId<MemberId>(body.sourceMemberId);
  const targetMemberId = brandId<MemberId>(body.targetMemberId);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const memberRows = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.systemId, systemId),
          or(eq(members.id, sourceMemberId), eq(members.id, targetMemberId)),
        ),
      );

    const foundIds = new Set(memberRows.map((m) => m.id));
    if (!foundIds.has(sourceMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source member not found in this system");
    }
    if (!foundIds.has(targetMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target member not found in this system");
    }

    const [row] = await tx
      .insert(relationships)
      .values({
        id: relationshipId,
        systemId,
        sourceMemberId,
        targetMemberId,
        type: body.type,
        bidirectional: body.bidirectional,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create relationship — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "relationship.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Relationship created",
      systemId,
    });

    return toRelationshipResult(row);
  });
}
