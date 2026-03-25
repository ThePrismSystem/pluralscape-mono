import { boardMessages } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateBoardMessageBodySchema,
  ReorderBoardMessagesBodySchema,
  UpdateBoardMessageBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
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
import type { BoardMessageId, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
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
    id: row.id as BoardMessageId,
    systemId: row.systemId as SystemId,
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

    return toBoardMessageResult(row);
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
      conditions.push(gt(boardMessages.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(boardMessages)
      .where(and(...conditions))
      .orderBy(boardMessages.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toBoardMessageResult);
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
    const setValues: Record<string, unknown> = {
      encryptedData: blob,
      updatedAt: timestamp,
      version: sql`${boardMessages.version} + 1`,
    };

    if (parsed.sortOrder !== undefined) {
      setValues.sortOrder = parsed.sortOrder;
    }

    if (parsed.pinned !== undefined) {
      setValues.pinned = parsed.pinned;
    }

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
          .where(
            and(
              eq(boardMessages.id, boardMessageId),
              eq(boardMessages.systemId, systemId),
              eq(boardMessages.archived, false),
            ),
          )
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

    return toBoardMessageResult(row);
  });
}

// ── PIN / UNPIN ─────────────────────────────────────────────────────

export async function pinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(boardMessages)
      .set({
        pinned: true,
        updatedAt: timestamp,
        version: sql`${boardMessages.version} + 1`,
      })
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.pinned, false),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: boardMessages.id, pinned: boardMessages.pinned })
        .from(boardMessages)
        .where(
          and(
            eq(boardMessages.id, boardMessageId),
            eq(boardMessages.systemId, systemId),
            eq(boardMessages.archived, false),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_PINNED", "Board message is already pinned");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    await audit(tx, {
      eventType: "board-message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message pinned",
      systemId,
    });

    return toBoardMessageResult(updated[0] as typeof boardMessages.$inferSelect);
  });
}

export async function unpinBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(boardMessages)
      .set({
        pinned: false,
        updatedAt: timestamp,
        version: sql`${boardMessages.version} + 1`,
      })
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.pinned, true),
          eq(boardMessages.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: boardMessages.id, pinned: boardMessages.pinned })
        .from(boardMessages)
        .where(
          and(
            eq(boardMessages.id, boardMessageId),
            eq(boardMessages.systemId, systemId),
            eq(boardMessages.archived, false),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "NOT_PINNED", "Board message is not pinned");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    await audit(tx, {
      eventType: "board-message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message unpinned",
      systemId,
    });

    return toBoardMessageResult(updated[0] as typeof boardMessages.$inferSelect);
  });
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
    // Pre-flight: verify all target board messages exist and are active
    const targetIds = parsed.data.operations.map((op) => op.boardMessageId);
    const existing = await tx
      .select({ id: boardMessages.id })
      .from(boardMessages)
      .where(and(eq(boardMessages.systemId, systemId), eq(boardMessages.archived, false)));
    const existingIds = new Set(existing.map((bm) => bm.id));
    for (const bmId of targetIds) {
      if (!existingIds.has(bmId)) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `Board message ${bmId} not found`);
      }
    }

    const results = await Promise.all(
      parsed.data.operations.map((op) =>
        tx
          .update(boardMessages)
          .set({ sortOrder: op.sortOrder })
          .where(
            and(
              eq(boardMessages.id, op.boardMessageId),
              eq(boardMessages.systemId, systemId),
              eq(boardMessages.archived, false),
            ),
          )
          .returning({ id: boardMessages.id }),
      ),
    );

    const ops = parsed.data.operations;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const op = ops[i];
      if ((!result || result.length === 0) && op) {
        throw new ApiHttpError(
          HTTP_NOT_FOUND,
          "NOT_FOUND",
          `Board message ${op.boardMessageId} not found`,
        );
      }
    }

    await audit(tx, {
      eventType: "board-message.reordered",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(parsed.data.operations.length)} board message(s)`,
      systemId,
    });
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: boardMessages.id })
      .from(boardMessages)
      .where(
        and(
          eq(boardMessages.id, boardMessageId),
          eq(boardMessages.systemId, systemId),
          eq(boardMessages.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Board message not found");
    }

    await audit(tx, {
      eventType: "board-message.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Board message deleted",
      systemId,
    });

    await tx
      .delete(boardMessages)
      .where(and(eq(boardMessages.id, boardMessageId), eq(boardMessages.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const BOARD_MESSAGE_LIFECYCLE = {
  table: boardMessages,
  columns: boardMessages,
  entityName: "Board message",
  archiveEvent: "board-message.archived" as const,
  restoreEvent: "board-message.restored" as const,
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
