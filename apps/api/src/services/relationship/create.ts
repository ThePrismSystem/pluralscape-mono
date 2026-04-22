import { members, relationships } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateRelationshipBodySchema } from "@pluralscape/validation";
import { and, eq, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toRelationshipResult } from "./internal.js";

import type { RelationshipResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createRelationship(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RelationshipResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateRelationshipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  // Reject nulls at API level (schema requires them, but be explicit)
  if (!parsed.sourceMemberId || !parsed.targetMemberId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "sourceMemberId and targetMemberId are required",
    );
  }

  const relationshipId = createId(ID_PREFIXES.relationship);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Validate both members exist in the same system
    const memberRows = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.systemId, systemId),
          or(eq(members.id, parsed.sourceMemberId), eq(members.id, parsed.targetMemberId)),
        ),
      );

    const foundIds = new Set(memberRows.map((m) => m.id));
    if (!foundIds.has(parsed.sourceMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source member not found in this system");
    }
    if (!foundIds.has(parsed.targetMemberId)) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target member not found in this system");
    }

    const [row] = await tx
      .insert(relationships)
      .values({
        id: relationshipId,
        systemId,
        sourceMemberId: parsed.sourceMemberId,
        targetMemberId: parsed.targetMemberId,
        type: parsed.type,
        bidirectional: parsed.bidirectional,
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
