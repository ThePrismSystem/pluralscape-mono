import { channels, messages } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreateMessageBodySchema, UpdateMessageBodySchema } from "@pluralscape/validation";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  ChannelId,
  MessageId,
  PaginatedResult,
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
  readonly before?: UnixMillis;
  readonly after?: UnixMillis;
  readonly includeArchived?: boolean;
}

interface TimestampHint {
  readonly timestamp?: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMessageResult(row: typeof messages.$inferSelect): MessageResult {
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
    // Verify channel exists and is a channel (not a category)
    const [channel] = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
          eq(channels.type, "channel"),
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
    await dispatchWebhookEvent(tx, systemId, "message.created", {
      messageId: row.id as MessageId,
      channelId: channelId,
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
      conditions.push(gt(messages.timestamp, opts.after));
    }

    // Composite cursor: (timestamp, id) descending
    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "message");
      const cursorCondition = or(
        lt(messages.timestamp, decoded.sortValue),
        and(eq(messages.timestamp, decoded.sortValue), lt(messages.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
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
      hasMore && lastItem ? toCompositeCursor(lastItem.timestamp, lastItem.id) : null;

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
    await dispatchWebhookEvent(tx, systemId, "message.updated", {
      messageId: row.id as MessageId,
      channelId: row.channelId as ChannelId,
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
      .select({ id: messages.id, channelId: messages.channelId })
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
    await dispatchWebhookEvent(tx, systemId, "message.deleted", {
      messageId: existing.id as MessageId,
      channelId: existing.channelId as ChannelId,
    });

    await tx
      .delete(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const MESSAGE_LIFECYCLE: ArchivableEntityConfig<MessageId> = {
  table: messages,
  columns: messages,
  entityName: "Message",
  archiveEvent: "message.archived" as const,
  restoreEvent: "message.restored" as const,
  onArchive: async (tx, sId, eid) => {
    const [msg] = await tx
      .select({ channelId: messages.channelId })
      .from(messages)
      .where(eq(messages.id, eid))
      .limit(1);
    if (msg) {
      await dispatchWebhookEvent(tx, sId, "message.archived", {
        messageId: eid,
        channelId: msg.channelId as ChannelId,
      });
    }
  },
  onRestore: async (tx, sId, eid) => {
    const [msg] = await tx
      .select({ channelId: messages.channelId })
      .from(messages)
      .where(eq(messages.id, eid))
      .limit(1);
    if (msg) {
      await dispatchWebhookEvent(tx, sId, "message.restored", {
        messageId: eid,
        channelId: msg.channelId as ChannelId,
      });
    }
  },
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
