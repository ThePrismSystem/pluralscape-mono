import {
  frontingComments,
  frontingSessions,
  systemStructureEntityMemberLinks,
} from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  CreateFrontingSessionBodySchema,
  EndFrontingSessionBodySchema,
  FrontingSessionQuerySchema,
  UpdateFrontingSessionBodySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { validateSubjectIds } from "../lib/validate-subject-ids.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ACTIVE_SESSIONS,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  CustomFrontId,
  EncryptedBlob,
  FrontingSessionId,
  MemberId,
  PaginatedResult,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface FrontingSessionResult {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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

// ── Helpers ─────────────────────────────────────────────────────────

function toFrontingSessionResult(row: {
  id: string;
  systemId: string;
  memberId: string | null;
  customFrontId: string | null;
  structureEntityId: string | null;
  startTime: number;
  endTime: number | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): FrontingSessionResult {
  return {
    id: brandId<FrontingSessionId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    memberId: row.memberId ? brandId<MemberId>(row.memberId) : null,
    customFrontId: row.customFrontId ? brandId<CustomFrontId>(row.customFrontId) : null,
    structureEntityId: row.structureEntityId
      ? brandId<SystemStructureEntityId>(row.structureEntityId)
      : null,
    startTime: toUnixMillis(row.startTime),
    endTime: toUnixMillisOrNull(row.endTime),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateFrontingSessionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  if (parsed.endTime !== undefined && parsed.endTime <= parsed.startTime) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "endTime must be after startTime");
  }

  const fsId = createId(ID_PREFIXES.frontingSession);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await validateSubjectIds(tx, systemId, parsed);

    const [row] = await tx
      .insert(frontingSessions)
      .values({
        id: fsId,
        systemId,
        startTime: parsed.startTime,
        endTime: parsed.endTime ?? null,
        memberId: parsed.memberId ?? null,
        customFrontId: parsed.customFrontId ?? null,
        structureEntityId: parsed.structureEntityId ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting session — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-session.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "fronting.started", {
      sessionId: brandId<FrontingSessionId>(row.id),
    });
    if (parsed.endTime !== undefined) {
      await audit(tx, {
        eventType: "fronting-session.ended",
        actor: { kind: "account", id: auth.accountId },
        detail: "Fronting session ended",
        systemId,
      });
      await dispatchWebhookEvent(tx, systemId, "fronting.ended", {
        sessionId: brandId<FrontingSessionId>(row.id),
      });
    }

    return toFrontingSessionResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

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

// ── GET ─────────────────────────────────────────────────────────────

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

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateFrontingSessionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(frontingSessions)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${frontingSessions.version} + 1`,
      })
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.version, version),
          eq(frontingSessions.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingSessions.id })
          .from(frontingSessions)
          .where(
            and(
              eq(frontingSessions.id, sessionId),
              eq(frontingSessions.systemId, systemId),
              eq(frontingSessions.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting session",
    );

    await audit(tx, {
      eventType: "fronting-session.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session updated",
      systemId,
    });

    return toFrontingSessionResult(row);
  });
}

// ── END SESSION ─────────────────────────────────────────────────────

export async function endFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingSessionResult> {
  assertSystemOwnership(systemId, auth);

  const result = EndFrontingSessionBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const { endTime, version } = result.data;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Read current session to validate state and endTime > startTime
    const [current] = await tx
      .select({
        id: frontingSessions.id,
        startTime: frontingSessions.startTime,
        endTime: frontingSessions.endTime,
      })
      .from(frontingSessions)
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.archived, false),
        ),
      )
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting session not found");
    }

    if (current.endTime !== null) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "ALREADY_ENDED", "Session already ended");
    }

    if (endTime <= current.startTime) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "endTime must be after startTime",
      );
    }

    const updated = await tx
      .update(frontingSessions)
      .set({
        endTime,
        updatedAt: timestamp,
        version: sql`${frontingSessions.version} + 1`,
      })
      .where(
        and(
          eq(frontingSessions.id, sessionId),
          eq(frontingSessions.systemId, systemId),
          eq(frontingSessions.startTime, current.startTime),
          eq(frontingSessions.version, version),
          eq(frontingSessions.archived, false),
          isNull(frontingSessions.endTime),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: frontingSessions.id })
          .from(frontingSessions)
          .where(
            and(
              eq(frontingSessions.id, sessionId),
              eq(frontingSessions.systemId, systemId),
              eq(frontingSessions.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Fronting session",
    );

    await audit(tx, {
      eventType: "fronting-session.ended",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting session ended",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "fronting.ended", { sessionId });

    return toFrontingSessionResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

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
    const [commentCount] = await tx
      .select({ count: count() })
      .from(frontingComments)
      .where(
        and(
          eq(frontingComments.frontingSessionId, sessionId),
          eq(frontingComments.archived, false),
        ),
      );

    if (!commentCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (commentCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Fronting session has ${String(commentCount.count)} non-archived comment(s). Archive or delete comments first.`,
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

// ── ARCHIVE ─────────────────────────────────────────────────────────

const FRONTING_SESSION_LIFECYCLE = {
  table: frontingSessions,
  columns: frontingSessions,
  entityName: "Fronting session",
  archiveEvent: "fronting-session.archived" as const,
  restoreEvent: "fronting-session.restored" as const,
};

export async function archiveFrontingSession(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sessionId: FrontingSessionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, sessionId, auth, audit, FRONTING_SESSION_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

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

// ── ACTIVE FRONTING ─────────────────────────────────────────────────

export interface ActiveFrontingResult {
  readonly sessions: readonly FrontingSessionResult[];
  readonly isCofronting: boolean;
  readonly entityMemberMap: Record<string, readonly string[]>;
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

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseFrontingSessionQuery(
  query: Record<string, string | undefined>,
): FrontingSessionListOptions {
  const result = FrontingSessionQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
