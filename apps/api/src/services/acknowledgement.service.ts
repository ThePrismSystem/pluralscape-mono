import { acknowledgements } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  ConfirmAcknowledgementBodySchema,
  CreateAcknowledgementBodySchema,
} from "@pluralscape/validation";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import {
  encryptedBlobToBase64,
  parseAndValidateBlob,
  validateEncryptedBlob,
} from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
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
  AcknowledgementId,
  MemberId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface AcknowledgementResult {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly confirmed: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListAcknowledgementOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly confirmed?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toAcknowledgementResult(row: typeof acknowledgements.$inferSelect): AcknowledgementResult {
  return {
    id: row.id as AcknowledgementId,
    systemId: row.systemId as SystemId,
    createdByMemberId: row.createdByMemberId as MemberId | null,
    confirmed: row.confirmed,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateAcknowledgementBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const ackId = createId(ID_PREFIXES.acknowledgement);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(acknowledgements)
      .values({
        id: ackId,
        systemId,
        createdByMemberId: parsed.createdByMemberId ?? null,
        confirmed: false,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create acknowledgement — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "acknowledgement.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Acknowledgement created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "acknowledgement.created", {
      acknowledgementId: row.id as AcknowledgementId,
    });

    return toAcknowledgementResult(row);
  });
}

// ── CONFIRM ─────────────────────────────────────────────────────────

export async function confirmAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = ConfirmAcknowledgementBodySchema.parse(params);

  const newBlob =
    parsed.encryptedData !== undefined
      ? validateEncryptedBlob(parsed.encryptedData, MAX_ENCRYPTED_DATA_BYTES)
      : undefined;

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select()
      .from(acknowledgements)
      .where(
        and(
          eq(acknowledgements.id, ackId),
          eq(acknowledgements.systemId, systemId),
          eq(acknowledgements.archived, false),
        ),
      )
      .limit(1)
      .for("update");

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Acknowledgement not found");
    }

    // Idempotent: already confirmed — return current state without writing
    if (existing.confirmed) {
      return toAcknowledgementResult(existing);
    }

    const [updated] = await tx
      .update(acknowledgements)
      .set({
        confirmed: true,
        updatedAt: timestamp,
        version: sql`${acknowledgements.version} + 1`,
        ...(newBlob !== undefined ? { encryptedData: newBlob } : {}),
      })
      .where(and(eq(acknowledgements.id, ackId), eq(acknowledgements.systemId, systemId)))
      .returning();

    if (!updated) {
      throw new Error("Failed to confirm acknowledgement — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "acknowledgement.confirmed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Acknowledgement confirmed",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "acknowledgement.confirmed", {
      acknowledgementId: ackId,
    });

    return toAcknowledgementResult(updated);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
): Promise<AcknowledgementResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(acknowledgements)
      .where(
        and(
          eq(acknowledgements.id, ackId),
          eq(acknowledgements.systemId, systemId),
          eq(acknowledgements.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Acknowledgement not found");
    }

    return toAcknowledgementResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listAcknowledgements(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListAcknowledgementOpts = {},
): Promise<PaginatedResult<AcknowledgementResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(acknowledgements.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(acknowledgements.archived, false));
    }

    if (opts.confirmed !== undefined) {
      conditions.push(eq(acknowledgements.confirmed, opts.confirmed));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "ack");
      const cursorCondition = or(
        lt(acknowledgements.createdAt, decoded.sortValue),
        and(eq(acknowledgements.createdAt, decoded.sortValue), lt(acknowledgements.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(acknowledgements)
      .where(and(...conditions))
      .orderBy(desc(acknowledgements.createdAt), desc(acknowledgements.id))
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toAcknowledgementResult);
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? toCompositeCursor(lastItem.createdAt, lastItem.id) : null;

    return { items, nextCursor, hasMore, totalCount: null };
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: acknowledgements.id })
      .from(acknowledgements)
      .where(
        and(
          eq(acknowledgements.id, ackId),
          eq(acknowledgements.systemId, systemId),
          eq(acknowledgements.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Acknowledgement not found");
    }

    await audit(tx, {
      eventType: "acknowledgement.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Acknowledgement deleted",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "acknowledgement.deleted", {
      acknowledgementId: ackId,
    });

    await tx
      .delete(acknowledgements)
      .where(and(eq(acknowledgements.id, ackId), eq(acknowledgements.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const ACK_LIFECYCLE: ArchivableEntityConfig<AcknowledgementId> = {
  table: acknowledgements,
  columns: acknowledgements,
  entityName: "Acknowledgement",
  archiveEvent: "acknowledgement.archived" as const,
  restoreEvent: "acknowledgement.restored" as const,
  onArchive: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "acknowledgement.archived", {
      acknowledgementId: eid,
    }),
  onRestore: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "acknowledgement.restored", {
      acknowledgementId: eid,
    }),
};

export async function archiveAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, ackId, auth, audit, ACK_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  return restoreEntity(db, systemId, ackId, auth, audit, ACK_LIFECYCLE, (row) =>
    toAcknowledgementResult(row as typeof acknowledgements.$inferSelect),
  );
}
