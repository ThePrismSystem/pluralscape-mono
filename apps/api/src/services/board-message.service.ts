import { boardMessages } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  BoardMessageQuerySchema,
  CreateBoardMessageBodySchema,
  ReorderBoardMessagesBodySchema,
  UpdateBoardMessageBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, deleteEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import { parseQuery } from "../lib/query-parse.js";
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
import type { ArchivableEntityConfig, DeletableEntityConfig } from "../lib/entity-lifecycle.js";
import type {
  ApiErrorCode,
  AuditEventType,
  BoardMessageId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface BoardMessageResult {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListBoardMessageOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly pinned?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toBoardMessageResult(row: typeof boardMessages.$inferSelect): BoardMessageResult {
  return {
    id: brandId<BoardMessageId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateBoardMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const boardMessageId = createId(ID_PREFIXES.boardMessage);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(boardMessages)
      .values({
        id: boardMessageId,
        systemId,
        pinned: parsed.pinned,
        sortOrder: parsed.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create board message — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "board-message.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message created",
      systemId,
    });
    const result = toBoardMessageResult(row);
    await dispatchWebhookEvent(tx, systemId, "board-message.created", {
      boardMessageId: result.id,
    });

    return result;
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listBoardMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListBoardMessageOpts = {},
): Promise<PaginatedResult<BoardMessageResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(boardMessages.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(boardMessages.archived, false));
    }

    if (opts.pinned !== undefined) {
      conditions.push(eq(boardMessages.pinned, opts.pinned));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "board message");
      const cursorCondition = or(
        gt(boardMessages.sortOrder, decoded.sortValue),
        and(eq(boardMessages.sortOrder, decoded.sortValue), gt(boardMessages.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(boardMessages)
      .where(and(...conditions))
      .orderBy(boardMessages.sortOrder, boardMessages.id)
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toBoardMessageResult,
      (i) => i.sortOrder,
    );
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(boardMessages)
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    return toBoardMessageResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateBoardMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setValues = {
      encryptedData: blob,
      updatedAt: timestamp,
      version: sql`${boardMessages.version} + 1`,
      ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      ...(parsed.pinned !== undefined ? { pinned: parsed.pinned } : {}),
    };

    const updated = await tx
      .update(boardMessages)
      .set(setValues)
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.version, version),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: boardMessages.id })
          .from(boardMessages)
          .where(and(eq(boardMessages.id, boardMessageId), eq(boardMessages.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Board message",
    );

    await audit(tx, {
      eventType: "board-message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message updated",
      systemId,
    });
    const result = toBoardMessageResult(row);
    await dispatchWebhookEvent(tx, systemId, "board-message.updated", {
      boardMessageId: result.id,
    });

    return result;
  });
}

// ── PIN / UNPIN ─────────────────────────────────────────────────────

interface TogglePinConfig {
  readonly targetValue: boolean;
  readonly alreadyError: { readonly code: ApiErrorCode; readonly message: string };
  readonly auditEvent: AuditEventType;
  readonly auditDetail: string;
  readonly webhookEvent: "board-message.pinned" | "board-message.unpinned";
}

const PIN_CONFIG: TogglePinConfig = {
  targetValue: true,
  alreadyError: { code: "ALREADY_PINNED", message: "Board message is already pinned" },
  auditEvent: "board-message.pinned",
  auditDetail: "Board message pinned",
  webhookEvent: "board-message.pinned",
};

const UNPIN_CONFIG: TogglePinConfig = {
  targetValue: false,
  alreadyError: { code: "NOT_PINNED", message: "Board message is not pinned" },
  auditEvent: "board-message.unpinned",
  auditDetail: "Board message unpinned",
  webhookEvent: "board-message.unpinned",
};

async function togglePinned(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: TogglePinConfig,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(boardMessages)
      .set({
        pinned: cfg.targetValue,
        updatedAt: timestamp,
        version: sql`${boardMessages.version} + 1`,
      })
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.pinned, !cfg.targetValue),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({
          id: boardMessages.id,
          pinned: boardMessages.pinned,
          archived: boardMessages.archived,
        })
        .from(boardMessages)
        .where(and(eq(boardMessages.id, boardMessageId), eq(boardMessages.systemId, systemId)))
        .limit(1);

      if (existing?.archived) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Board message is already archived",
        );
      }
      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, cfg.alreadyError.code, cfg.alreadyError.message);
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    await audit(tx, {
      eventType: cfg.auditEvent,
      actor: { kind: "account", id: auth.accountId },
      detail: cfg.auditDetail,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, cfg.webhookEvent, {
      boardMessageId: boardMessageId,
    });

    const row = updated[0];
    if (!row) {
      throw new Error("togglePinned: UPDATE returned no rows after length check");
    }
    return toBoardMessageResult(row);
  });
}

export async function pinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return togglePinned(db, systemId, boardMessageId, auth, audit, PIN_CONFIG);
}

export async function unpinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return togglePinned(db, systemId, boardMessageId, auth, audit, UNPIN_CONFIG);
}

// ── REORDER ─────────────────────────────────────────────────────────

export async function reorderBoardMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const parsed = ReorderBoardMessagesBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid reorder payload");
  }

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Reject duplicate board message IDs
    const targetIds = parsed.data.operations.map((op) => op.boardMessageId);
    if (new Set(targetIds).size !== targetIds.length) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Duplicate board message IDs in reorder operations",
      );
    }

    // Batch UPDATE with CASE/WHEN — single round-trip instead of N
    const cases = parsed.data.operations.map(
      (op) => sql`WHEN ${boardMessages.id} = ${op.boardMessageId} THEN ${op.sortOrder}`,
    );

    const updatedRows = await tx
      .update(boardMessages)
      .set({
        sortOrder: sql<number>`CASE ${sql.join(cases, sql` `)} ELSE ${boardMessages.sortOrder} END::integer`,
      })
      .where(
        and(
          inArray(boardMessages.id, targetIds),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.archived, false),
        ),
      )
      .returning({ id: boardMessages.id });

    if (updatedRows.length !== parsed.data.operations.length) {
      const updatedIds = new Set(updatedRows.map((r) => r.id));
      const missing = targetIds.filter((id) => !updatedIds.has(id));
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Board message(s) not found: ${missing.join(", ")}`,
      );
    }

    await audit(tx, {
      eventType: "board-message.reordered",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(parsed.data.operations.length)} board message(s)`,
      systemId,
    });
    await Promise.all(
      parsed.data.operations.map((op) =>
        dispatchWebhookEvent(tx, systemId, "board-message.reordered", {
          boardMessageId: op.boardMessageId,
        }),
      ),
    );
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

const BOARD_MESSAGE_DELETE: DeletableEntityConfig<BoardMessageId> = {
  table: boardMessages,
  columns: boardMessages,
  entityName: "Board message",
  deleteEvent: "board-message.deleted",
  onDelete: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.deleted", { boardMessageId: eid }),
};

export async function deleteBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_DELETE);
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const BOARD_MESSAGE_LIFECYCLE: ArchivableEntityConfig<BoardMessageId> = {
  table: boardMessages,
  columns: boardMessages,
  entityName: "Board message",
  archiveEvent: "board-message.archived" as const,
  restoreEvent: "board-message.restored" as const,
  onArchive: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.archived", {
      boardMessageId: eid,
    }),
  onRestore: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.restored", {
      boardMessageId: eid,
    }),
};

export async function archiveBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return restoreEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_LIFECYCLE, (row) =>
    toBoardMessageResult(row as typeof boardMessages.$inferSelect),
  );
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseBoardMessageQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  pinned?: boolean;
} {
  return parseQuery(BoardMessageQuerySchema, query);
}
