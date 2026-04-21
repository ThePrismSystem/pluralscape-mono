import { frontingComments } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toFrontingCommentResult } from "./internal.js";

import type { FrontingCommentResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { FrontingCommentId, FrontingSessionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment deleted",
      systemId,
    });

    await tx
      .delete(frontingComments)
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
        ),
      );
  });
}

export async function archiveFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        archived: true,
        archivedAt: timestamp,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, false),
        ),
      )
      .returning({ id: frontingComments.id });

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: frontingComments.id })
        .from(frontingComments)
        .where(
          and(
            eq(frontingComments.id, commentId),
            eq(frontingComments.systemId, systemId),
            eq(frontingComments.frontingSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Fronting comment is already archived",
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment archived",
      systemId,
    });
  });
}

export async function restoreFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingComments)
      .set({
        archived: false,
        archivedAt: null,
        updatedAt: timestamp,
        version: sql`${frontingComments.version} + 1`,
      })
      .where(
        and(
          eq(frontingComments.id, commentId),
          eq(frontingComments.systemId, systemId),
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, true),
        ),
      )
      .returning();

    const row = updated[0];
    if (!row) {
      const [existing] = await tx
        .select({ id: frontingComments.id })
        .from(frontingComments)
        .where(
          and(
            eq(frontingComments.id, commentId),
            eq(frontingComments.systemId, systemId),
            eq(frontingComments.frontingSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "NOT_ARCHIVED", "Fronting comment is not archived");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    await audit(tx, {
      eventType: "fronting-comment.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting comment restored",
      systemId,
    });

    return toFrontingCommentResult(row);
  });
}
