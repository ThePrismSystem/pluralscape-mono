import { frontingComments, frontingSessions } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { validateSubjectIds } from "../../../lib/validate-subject-ids.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toFrontingCommentResult } from "./internal.js";

import type { FrontingCommentResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  FrontingCommentId,
  FrontingSessionId,
  ServerInternal,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { CreateFrontingCommentBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

async function resolveSessionStartTime(
  tx: PostgresJsDatabase,
  sessionId: FrontingSessionId,
  systemId: SystemId,
): Promise<ServerInternal<UnixMillis>> {
  const [session] = await tx
    .select({ startTime: frontingSessions.startTime, archived: frontingSessions.archived })
    .from(frontingSessions)
    .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
    .limit(1);

  if (!session) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
  }

  if (session.archived) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "SESSION_ARCHIVED",
      "Cannot add comments to an archived session",
    );
  }

  return session.startTime as ServerInternal<UnixMillis>;
}

export async function createFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  body: z.infer<typeof CreateFrontingCommentBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const commentId = brandId<FrontingCommentId>(createId(ID_PREFIXES.frontingComment));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const sessionStartTime = await resolveSessionStartTime(tx, sessionId, systemId);
    await validateSubjectIds(tx, systemId, body);

    const [row] = await tx
      .insert(frontingComments)
      .values({
        id: commentId,
        frontingSessionId: sessionId,
        systemId,
        sessionStartTime,
        memberId: body.memberId ?? null,
        customFrontId: body.customFrontId ?? null,
        structureEntityId: body.structureEntityId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting comment — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-comment.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment created",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}
