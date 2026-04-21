import { frontingComments, frontingSessions } from "@pluralscape/db/pg";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";

import { toFrontingCommentResult } from "./internal.js";

import type { FrontingCommentResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  FrontingCommentId,
  FrontingSessionId,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listFrontingComments(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  opts?: { cursor?: string; limit?: number; includeArchived?: boolean },
): Promise<PaginatedResult<FrontingCommentResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify parent session exists and belongs to this system
    const [session] = await tx
      .select({ id: frontingSessions.id })
      .from(frontingSessions)
      .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
      .limit(1);

    if (!session) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    const effectiveLimit = Math.min(opts?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [
      eq(frontingComments.systemId, systemId),
      eq(frontingComments.frontingSessionId, sessionId),
    ];

    if (!opts?.includeArchived) {
      conditions.push(eq(frontingComments.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(lt(frontingComments.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(frontingComments)
      .where(and(...conditions))
      .orderBy(desc(frontingComments.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toFrontingCommentResult);
  });
}

export async function getFrontingComment(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  commentId: FrontingCommentId,
  auth: AuthContext,
): Promise<FrontingCommentResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify parent session exists and belongs to this system
    const [session] = await tx
      .select({ id: frontingSessions.id })
      .from(frontingSessions)
      .where(and(eq(frontingSessions.id, sessionId), eq(frontingSessions.systemId, systemId)))
      .limit(1);

    if (!session) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    const [row] = await tx
      .select()
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

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting comment not found");
    }

    return toFrontingCommentResult(row);
  });
}
