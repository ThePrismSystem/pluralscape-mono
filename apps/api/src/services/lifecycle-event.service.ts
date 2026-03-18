import { lifecycleEvents } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateLifecycleEventBodySchema, validateLifecycleMetadata } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, LifecycleEventId, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface LifecycleEventResult {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: string;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly encryptedData: string;
  readonly plaintextMetadata: Record<string, unknown> | null;
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
  eventType: string;
  occurredAt: number;
  recordedAt: number;
  encryptedData: EncryptedBlob;
  plaintextMetadata?: Record<string, unknown> | null;
}): LifecycleEventResult {
  return {
    id: row.id as LifecycleEventId,
    systemId: row.systemId as SystemId,
    eventType: row.eventType,
    occurredAt: row.occurredAt as UnixMillis,
    recordedAt: row.recordedAt as UnixMillis,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    plaintextMetadata: row.plaintextMetadata ?? null,
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
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateLifecycleEventBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const eventId = createId(ID_PREFIXES.lifecycleEvent);
  const timestamp = now();

  // Validate per-event-type metadata if provided
  let metadata: Record<string, unknown> | null = null;
  if (parsed.plaintextMetadata) {
    const metaResult = validateLifecycleMetadata(parsed.eventType, parsed.plaintextMetadata);
    if (!metaResult.success) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Invalid plaintext metadata for event type "${parsed.eventType}"`,
      );
    }
    metadata = parsed.plaintextMetadata as Record<string, unknown>;
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(lifecycleEvents)
      .values({
        id: eventId,
        systemId,
        eventType: parsed.eventType,
        occurredAt: parsed.occurredAt,
        recordedAt: timestamp,
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
): Promise<PaginatedLifecycleEvents> {
  await assertSystemOwnership(db, systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [eq(lifecycleEvents.systemId, systemId)];

  if (eventType) {
    conditions.push(sql`${lifecycleEvents.eventType} = ${eventType}`);
  }

  if (cursor) {
    const parsed = decodeCursor(cursor);
    conditions.push(
      sql`(${lifecycleEvents.occurredAt} < ${parsed.occurredAt} OR (${lifecycleEvents.occurredAt} = ${parsed.occurredAt} AND ${lifecycleEvents.id} < ${parsed.id}))`,
    );
  }

  const rows = await db
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
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
): Promise<LifecycleEventResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(lifecycleEvents)
    .where(and(eq(lifecycleEvents.id, eventId), eq(lifecycleEvents.systemId, systemId)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
  }

  return toLifecycleEventResult(row);
}
