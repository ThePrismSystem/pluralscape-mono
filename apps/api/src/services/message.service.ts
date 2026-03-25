import { channels, messages } from "@pluralscape/db/pg";
import {
  ID_PREFIXES,
  PAGINATION,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { CreateMessageBodySchema, UpdateMessageBodySchema } from "@pluralscape/validation";
import { and, eq, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { fromCursor, toCursor } from "../lib/pagination.js";
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
  ChannelId,
  EncryptedBlob,
  MessageId,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface MessageResult {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListMessageOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly before?: number;
  readonly after?: number;
  readonly includeArchived?: boolean;
}

interface TimestampHint {
  readonly timestamp?: number;
}

// ── Cursor helpers (composite timestamp+id) ─────────────────────────

function toMessageCursor(timestamp: number, id: string): PaginationCursor {
  return toCursor(JSON.stringify({ t: timestamp, i: id }));
}

interface DecodedMessageCursor {
  readonly timestamp: number;
  readonly id: string;
}

function fromMessageCursor(cursor: string): DecodedMessageCursor {
  let raw: string;
  try {
    raw = fromCursor(cursor as PaginationCursor, PAGINATION.cursorTtlMs);
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed message cursor");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed message cursor");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).t !== "number" ||
    typeof (parsed as Record<string, unknown>).i !== "string"
  ) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed message cursor");
  }
  return {
    timestamp: (parsed as { t: number }).t,
    id: (parsed as { i: string }).i,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMessageResult(row: {
  id: string;
  channelId: string;
  systemId: string;
  replyToId: string | null;
  timestamp: number;
  editedAt: number | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): MessageResult {
  return {
    id: row.id as MessageId,
    channelId: row.channelId as ChannelId,
    systemId: row.systemId as SystemId,
    replyToId: (row.replyToId as MessageId | null) ?? null,
    timestamp: toUnixMillis(row.timestamp),
    editedAt: toUnixMillisOrNull(row.editedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/** Build conditions for finding a message by id+systemId, optionally with timestamp for partition pruning. */
function messageIdConditions(messageId: MessageId, systemId: SystemId, hint?: TimestampHint) {
  const conditions = [eq(messages.id, messageId), eq(messages.systemId, systemId)];
  if (hint?.timestamp !== undefined) {
    conditions.push(eq(messages.timestamp, hint.timestamp));
  }
  return conditions;
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const messageId = createId(ID_PREFIXES.message);
  const ts = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify channel exists
    const [channel] = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
        ),
      )
      .limit(1);

    if (!channel) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    const [row] = await tx
      .insert(messages)
      .values({
        id: messageId,
        channelId,
        systemId,
        replyToId: parsed.replyToId ?? null,
        timestamp: parsed.timestamp,
        encryptedData: blob,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create message — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "message.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message created",
      systemId,
    });

    return toMessageResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  opts: ListMessageOpts = {},
): Promise<PaginatedResult<MessageResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(messages.channelId, channelId), eq(messages.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(messages.archived, false));
    }

    // Timestamp range filters for partition pruning
    if (opts.before !== undefined) {
      conditions.push(lt(messages.timestamp, opts.before));
    }
    if (opts.after !== undefined) {
      conditions.push(sql`${messages.timestamp} > ${new Date(opts.after).toISOString()}`);
    }

    // Composite cursor: (timestamp, id) descending
    if (opts.cursor) {
      const decoded = fromMessageCursor(opts.cursor);
      const cursorTs = new Date(decoded.timestamp).toISOString();
      conditions.push(
        sql`(${messages.timestamp} < ${cursorTs} OR (${messages.timestamp} = ${cursorTs} AND ${messages.id} < ${decoded.id}))`,
      );
    }

    const rows = await tx
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(sql`${messages.timestamp} DESC, ${messages.id} DESC`)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toMessageResult);
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? toMessageCursor(lastItem.timestamp, lastItem.id) : null;

    return { items, nextCursor, hasMore, totalCount: null };
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  hint?: TimestampHint,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Message not found");
    }

    return toMessageResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
  hint?: TimestampHint,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const ts = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(messages)
      .set({
        encryptedData: blob,
        editedAt: ts,
        updatedAt: ts,
        version: sql`${messages.version} + 1`,
      })
      .where(
        and(
          ...messageIdConditions(messageId, systemId, hint),
          eq(messages.version, version),
          eq(messages.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Message",
    );

    await audit(tx, {
      eventType: "message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message updated",
      systemId,
    });

    return toMessageResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
  hint?: TimestampHint,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Message not found");
    }

    await audit(tx, {
      eventType: "message.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message deleted",
      systemId,
    });

    await tx.delete(messages).where(and(...messageIdConditions(messageId, systemId, hint)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const MESSAGE_LIFECYCLE = {
  table: messages,
  columns: messages,
  entityName: "Message",
  archiveEvent: "message.archived" as const,
  restoreEvent: "message.restored" as const,
};

export async function archiveMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, messageId, auth, audit, MESSAGE_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MessageResult> {
  return restoreEntity(db, systemId, messageId, auth, audit, MESSAGE_LIFECYCLE, (row) =>
    toMessageResult(row as typeof messages.$inferSelect),
  );
}
