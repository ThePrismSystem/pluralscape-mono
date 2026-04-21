import { frontingSessions, systemStructureEntityMemberLinks } from "@pluralscape/db/pg";
import { FrontingSessionQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ACTIVE_SESSIONS,
  MAX_PAGE_LIMIT,
} from "../../service.constants.js";

import { toFrontingSessionResult } from "./internal.js";

import type { FrontingSessionResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface FrontingSessionListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly memberId?: MemberId;
  readonly customFrontId?: CustomFrontId;
  readonly structureEntityId?: SystemStructureEntityId;
  readonly startFrom?: number;
  readonly startUntil?: number;
  readonly endFrom?: number;
  readonly endUntil?: number;
  readonly activeOnly?: boolean;
  readonly includeArchived?: boolean;
}

export interface ActiveFrontingResult {
  readonly sessions: readonly FrontingSessionResult[];
  readonly isCofronting: boolean;
  readonly entityMemberMap: Record<string, readonly string[]>;
}

export async function listFrontingSessions(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: FrontingSessionListOptions = {},
): Promise<PaginatedResult<FrontingSessionResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(frontingSessions.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(frontingSessions.archived, false));
    }

    if (opts.memberId) {
      conditions.push(eq(frontingSessions.memberId, opts.memberId));
    }

    if (opts.customFrontId) {
      conditions.push(eq(frontingSessions.customFrontId, opts.customFrontId));
    }

    if (opts.structureEntityId) {
      conditions.push(eq(frontingSessions.structureEntityId, opts.structureEntityId));
    }

    if (opts.activeOnly && (opts.endFrom !== undefined || opts.endUntil !== undefined)) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Cannot combine activeOnly with endFrom or endUntil filters",
      );
    }

    if (opts.startFrom !== undefined) {
      conditions.push(gte(frontingSessions.startTime, opts.startFrom));
    }

    if (opts.startUntil !== undefined) {
      conditions.push(lte(frontingSessions.startTime, opts.startUntil));
    }

    // End-time filters exclude active sessions (null endTime) by requiring endTime IS NOT NULL
    if (opts.endFrom !== undefined || opts.endUntil !== undefined) {
      conditions.push(isNotNull(frontingSessions.endTime));
    }
    if (opts.endFrom !== undefined) {
      conditions.push(gte(frontingSessions.endTime, opts.endFrom));
    }
    if (opts.endUntil !== undefined) {
      conditions.push(lte(frontingSessions.endTime, opts.endUntil));
    }

    if (opts.activeOnly) {
      conditions.push(isNull(frontingSessions.endTime));
    }

    if (opts.cursor) {
      conditions.push(lt(frontingSessions.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(frontingSessions)
      .where(and(...conditions))
      .orderBy(desc(frontingSessions.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toFrontingSessionResult);
  });
}

export async function getFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(frontingSessions)
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    return toFrontingSessionResult(row);
  });
}

export async function getActiveFronting(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<ActiveFrontingResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select()
      .from(frontingSessions)
      .where(
        and(
          eq(frontingSessions.systemId, systemId),
          isNull(frontingSessions.endTime),
          eq(frontingSessions.archived, false),
        ),
      )
      .orderBy(desc(frontingSessions.startTime))
      .limit(MAX_ACTIVE_SESSIONS);

    const sessions = rows.map(toFrontingSessionResult);

    // Collect structure entity IDs from active sessions
    const entityIds = rows
      .map((r) => r.structureEntityId)
      .filter((id): id is string => id !== null);

    // Resolve member associations for fronting structure entities
    const entityMemberMap: Record<string, readonly string[]> = {};
    if (entityIds.length > 0) {
      const links = await tx
        .select({
          parentEntityId: systemStructureEntityMemberLinks.parentEntityId,
          memberId: systemStructureEntityMemberLinks.memberId,
        })
        .from(systemStructureEntityMemberLinks)
        .where(
          and(
            eq(systemStructureEntityMemberLinks.systemId, systemId),
            inArray(systemStructureEntityMemberLinks.parentEntityId, entityIds),
          ),
        );

      for (const link of links) {
        if (link.parentEntityId) {
          const existing = entityMemberMap[link.parentEntityId];
          if (existing) {
            entityMemberMap[link.parentEntityId] = [...existing, link.memberId];
          } else {
            entityMemberMap[link.parentEntityId] = [link.memberId];
          }
        }
      }
    }

    // Custom fronts represent abstract cognitive states (e.g. "Dissociated"), not members.
    // Only count sessions with a member or structure entity subject for co-fronting.
    const memberSessions = sessions.filter(
      (s) => s.memberId !== null || s.structureEntityId !== null,
    );

    return {
      sessions,
      isCofronting: memberSessions.length > 1,
      entityMemberMap,
    };
  });
}

export function parseFrontingSessionQuery(
  query: Record<string, string | undefined>,
): FrontingSessionListOptions {
  const result = FrontingSessionQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
