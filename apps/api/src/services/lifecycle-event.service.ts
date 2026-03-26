import { lifecycleEvents } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import {
  CreateLifecycleEventBodySchema,
  validateLifecycleMetadata,
  type PlaintextMetadata,
} from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import {
  archiveEntity,
  restoreEntity,
  type ArchivableEntityConfig,
} from "../lib/entity-lifecycle.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  LifecycleEventId,
  LifecycleEventType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface LifecycleEventResult {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly encryptedData: string;
  readonly plaintextMetadata: PlaintextMetadata | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly updatedAt: UnixMillis;
}

export interface LifecycleEventCursor {
  readonly occurredAt: number;
  readonly id: string;
}

export interface PaginatedLifecycleEvents {
  readonly items: readonly LifecycleEventResult[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount: null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toLifecycleEventResult(row: {
  id: string;
  systemId: string;
  eventType: LifecycleEventType;
  occurredAt: number;
  recordedAt: number;
  updatedAt: number;
  encryptedData: EncryptedBlob;
  plaintextMetadata?: PlaintextMetadata | null;
  version: number;
  archived: boolean;
  archivedAt: number | null;
}): LifecycleEventResult {
  return {
    id: row.id as LifecycleEventId,
    systemId: row.systemId as SystemId,
    eventType: row.eventType,
    occurredAt: toUnixMillis(row.occurredAt),
    recordedAt: toUnixMillis(row.recordedAt),
    updatedAt: toUnixMillis(row.updatedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    plaintextMetadata: row.plaintextMetadata ?? null,
    version: row.version,
    archived: row.archived,
    archivedAt: row.archivedAt !== null ? toUnixMillis(row.archivedAt) : null,
  };
}

function encodeCursor(occurredAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt, id })).toString("base64");
}

function decodeCursor(cursor: string): LifecycleEventCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "occurredAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as LifecycleEventCursor).occurredAt === "number" &&
      typeof (parsed as LifecycleEventCursor).id === "string"
    ) {
      return parsed as LifecycleEventCursor;
    }
  } catch {
    // fall through
  }
  throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor format");
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateLifecycleEventBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const eventId = createId(ID_PREFIXES.lifecycleEvent);
  const timestamp = now();

  // Validate per-event-type metadata if provided
  let metadata: PlaintextMetadata | null = null;
  if (parsed.plaintextMetadata) {
    const metaResult = validateLifecycleMetadata(parsed.eventType, parsed.plaintextMetadata);
    if (!metaResult.success) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Invalid plaintext metadata for event type "${parsed.eventType}"`,
      );
    }
    metadata = parsed.plaintextMetadata;
  }

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(lifecycleEvents)
      .values({
        id: eventId,
        systemId,
        eventType: parsed.eventType,
        occurredAt: parsed.occurredAt,
        recordedAt: timestamp,
        updatedAt: timestamp,
        encryptedData: blob,
        plaintextMetadata: metadata,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create lifecycle event — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "lifecycle-event.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Lifecycle event ${parsed.eventType} recorded`,
      systemId,
    });

    return toLifecycleEventResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listLifecycleEvents(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  eventType?: string,
  includeArchived = false,
): Promise<PaginatedLifecycleEvents> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(lifecycleEvents.systemId, systemId)];

    if (!includeArchived) {
      conditions.push(eq(lifecycleEvents.archived, false));
    }

    if (eventType) {
      conditions.push(sql`${lifecycleEvents.eventType} = ${eventType}`);
    }

    if (cursor) {
      const parsed = decodeCursor(cursor);
      conditions.push(
        sql`(${lifecycleEvents.occurredAt} < ${parsed.occurredAt} OR (${lifecycleEvents.occurredAt} = ${parsed.occurredAt} AND ${lifecycleEvents.id} < ${parsed.id}))`,
      );
    }

    const rows = await tx
      .select()
      .from(lifecycleEvents)
      .where(and(...conditions))
      .orderBy(sql`${lifecycleEvents.occurredAt} DESC, ${lifecycleEvents.id} DESC`)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toLifecycleEventResult);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.occurredAt, lastItem.id) : null;

    return {
      items,
      nextCursor,
      hasMore,
      totalCount: null,
    };
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(lifecycleEvents)
      .where(and(eq(lifecycleEvents.id, eventId), eq(lifecycleEvents.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
    }

    return toLifecycleEventResult(row);
  });
}

// ── DELETE ──────────────────────────────────────────────────────────

export async function deleteLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(lifecycleEvents)
      .where(and(eq(lifecycleEvents.id, eventId), eq(lifecycleEvents.systemId, systemId)))
      .returning({ id: lifecycleEvents.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
    }

    await audit(tx, {
      eventType: "lifecycle-event.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Lifecycle event deleted",
      systemId,
    });
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const LIFECYCLE_EVENT_LIFECYCLE: ArchivableEntityConfig<LifecycleEventId> = {
  table: lifecycleEvents,
  columns: lifecycleEvents,
  entityName: "Lifecycle event",
  archiveEvent: "lifecycle-event.archived",
  restoreEvent: "lifecycle-event.restored",
};

export async function archiveLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, eventId, auth, audit, LIFECYCLE_EVENT_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<LifecycleEventResult> {
  return restoreEntity(db, systemId, eventId, auth, audit, LIFECYCLE_EVENT_LIFECYCLE, (row) =>
    toLifecycleEventResult(row as typeof lifecycleEvents.$inferSelect),
  );
}
