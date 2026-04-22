import { frontingComments, frontingSessions } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toFrontingSessionResult } from "./internal.js";

import type { FrontingSessionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingSessionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const FRONTING_SESSION_LIFECYCLE = {
  table: frontingSessions,
  columns: frontingSessions,
  entityName: "Fronting session",
  archiveEvent: "fronting-session.archived" as const,
  restoreEvent: "fronting-session.restored" as const,
};

export async function deleteFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: frontingSessions.id, startTime: frontingSessions.startTime })
      .from(frontingSessions)
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    // Check for non-archived dependent fronting comments
    const { dependents } = await checkDependents(tx, [
      {
        table: frontingComments,
        predicate: and(
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, false),
        ),
        typeName: "frontingComments",
      },
    ]);

    const commentDep = dependents.find((d) => d.type === "frontingComments");
    if (commentDep) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Fronting session has ${String(commentDep.count)} non-archived comment(s). Archive or delete comments first.`,
      );
    }

    await audit(tx, {
      eventType: "fronting-session.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session deleted",
      systemId,
    });

    await tx
      .delete(frontingSessions)
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.startTime, existing.startTime),
        ),
      );
  });
}

export async function archiveFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, sessionId, auth, audit, FRONTING_SESSION_LIFECYCLE);
}

export async function restoreFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  return restoreEntity(db, systemId, sessionId, auth, audit, FRONTING_SESSION_LIFECYCLE, (row) =>
    toFrontingSessionResult(row as typeof frontingSessions.$inferSelect),
  );
}
