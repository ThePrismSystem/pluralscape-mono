import { frontingComments } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../../lib/occ-update.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toFrontingCommentResult } from "./internal.js";

import type { FrontingCommentResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { FrontingCommentId, FrontingSessionId, SystemId } from "@pluralscape/types";
import type { UpdateFrontingCommentBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  body: z.infer<typeof UpdateFrontingCommentBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.version, version),
          eq(frontingComments.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingComments.id })
          .from(frontingComments)
          .where(
            and(
              eq(frontingComments.id, commentId),
              eq(frontingComments.systemId, systemId),
              eq(frontingComments.frontingSessionId, sessionId),
              eq(frontingComments.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting comment",
    );

    await audit(tx, {
      eventType: "fronting-comment.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment updated",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}
