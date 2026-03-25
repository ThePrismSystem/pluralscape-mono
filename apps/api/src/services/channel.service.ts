import { channels, messages } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreateChannelBodySchema, UpdateChannelBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
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
import type {
  ChannelId,
  EncryptedBlob,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface ChannelResult {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly type: "category" | "channel";
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListChannelOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly type?: "category" | "channel";
  readonly parentId?: ChannelId;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toChannelResult(row: {
  id: string;
  systemId: string;
  type: string;
  parentId: string | null;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): ChannelResult {
  return {
    id: row.id as ChannelId,
    systemId: row.systemId as SystemId,
    type: row.type as "category" | "channel",
    parentId: (row.parentId as ChannelId | null) ?? null,
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

export async function createChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateChannelBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  // Categories cannot have a parent
  if (parsed.type === "category" && parsed.parentId) {
    throw new ApiHttpError(HTTP_CONFLICT, "INVALID_HIERARCHY", "Categories cannot have a parent");
  }

  const channelId = createId(ID_PREFIXES.channel);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // If parentId provided, validate it exists, belongs to system, and is a category
    if (parsed.parentId) {
      const [parent] = await tx
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(
          and(
            eq(channels.id, parsed.parentId),
            eq(channels.systemId, systemId),
            eq(channels.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent channel not found");
      }

      if (parent.type !== "category") {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "INVALID_HIERARCHY",
          "Channels can only be nested under categories",
        );
      }
    }

    const [row] = await tx
      .insert(channels)
      .values({
        id: channelId,
        systemId,
        type: parsed.type,
        parentId: parsed.parentId ?? null,
        sortOrder: parsed.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create channel — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "channel.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Channel created (type: ${parsed.type})`,
      systemId,
    });

    return toChannelResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listChannels(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListChannelOpts = {},
): Promise<PaginatedResult<ChannelResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(channels.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(channels.archived, false));
    }

    if (opts.type) {
      conditions.push(eq(channels.type, opts.type));
    }

    if (opts.parentId) {
      conditions.push(eq(channels.parentId, opts.parentId));
    }

    if (opts.cursor) {
      conditions.push(gt(channels.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(channels)
      .where(and(...conditions))
      .orderBy(channels.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toChannelResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    return toChannelResult(row);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateChannelBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setValues: Record<string, unknown> = {
      encryptedData: blob,
      updatedAt: timestamp,
      version: sql`${channels.version} + 1`,
    };

    if (parsed.sortOrder !== undefined) {
      setValues.sortOrder = parsed.sortOrder;
    }

    const updated = await tx
      .update(channels)
      .set(setValues)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.version, version),
          eq(channels.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
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
        return existing;
      },
      "Channel",
    );

    await audit(tx, {
      eventType: "channel.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Channel updated",
      systemId,
    });

    return toChannelResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

type ChannelDependentType = "channels" | "messages";

export async function deleteChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    // Check for dependents in parallel
    const [childChannelResult, messageResult] = await Promise.all([
      tx
        .select({ count: count() })
        .from(channels)
        .where(and(eq(channels.parentId, channelId), eq(channels.systemId, systemId))),
      tx
        .select({ count: count() })
        .from(messages)
        .where(and(eq(messages.channelId, channelId), eq(messages.systemId, systemId))),
    ]);

    const dependents: { type: ChannelDependentType; count: number }[] = [];

    const childCount = childChannelResult[0]?.count ?? 0;
    if (childCount > 0) {
      dependents.push({ type: "channels", count: childCount });
    }

    const msgCount = messageResult[0]?.count ?? 0;
    if (msgCount > 0) {
      dependents.push({ type: "messages", count: msgCount });
    }

    if (dependents.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Channel has dependents. Remove all dependents before deleting.",
        { dependents },
      );
    }

    await audit(tx, {
      eventType: "channel.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Channel deleted",
      systemId,
    });

    await tx
      .delete(channels)
      .where(and(eq(channels.id, channelId), eq(channels.systemId, systemId)));
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const CHANNEL_LIFECYCLE = {
  table: channels,
  columns: channels,
  entityName: "Channel",
  archiveEvent: "channel.archived" as const,
  restoreEvent: "channel.restored" as const,
};

export async function archiveChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, channelId, auth, audit, CHANNEL_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  return restoreEntity(db, systemId, channelId, auth, audit, CHANNEL_LIFECYCLE, (row) =>
    toChannelResult(row as typeof channels.$inferSelect),
  );
}
