import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { groupMemberships, groups } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { CreateGroupBodySchema, UpdateGroupBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
} from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import {
  DEFAULT_GROUP_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_GROUP_LIMIT,
} from "../routes/groups/groups.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  GroupId,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface GroupResult {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly parentGroupId: GroupId | null;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function encryptedBlobToBase64(blob: EncryptedBlob): string {
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64");
}

function toGroupResult(row: {
  id: string;
  systemId: string;
  parentGroupId: string | null;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): GroupResult {
  return {
    id: row.id as GroupId,
    systemId: row.systemId as SystemId,
    parentGroupId: row.parentGroupId as GroupId | null,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

function assertSystemOwnership(auth: AuthContext, systemId: SystemId): void {
  if (auth.systemId !== systemId) {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "System access denied");
  }
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const parsed = CreateGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const rawBytes = Buffer.from(parsed.data.encryptedData, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  const groupId = createId(ID_PREFIXES.group);
  const timestamp = now();

  return db.transaction(async (tx) => {
    // Validate parentGroupId exists in same system if non-null
    if (parsed.data.parentGroupId !== null) {
      const [parent] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(
            eq(groups.id, parsed.data.parentGroupId),
            eq(groups.systemId, systemId),
            eq(groups.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent group not found");
      }
    }

    const [row] = await tx
      .insert(groups)
      .values({
        id: groupId,
        systemId,
        parentGroupId: parsed.data.parentGroupId,
        sortOrder: parsed.data.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create group — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "group.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group created",
      systemId,
    });

    return toGroupResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listGroups(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_GROUP_LIMIT,
): Promise<PaginatedResult<GroupResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_GROUP_LIMIT);

  const conditions = [eq(groups.systemId, systemId), eq(groups.archived, false)];

  if (cursor) {
    conditions.push(gt(groups.id, cursor));
  }

  const rows = await db
    .select()
    .from(groups)
    .where(and(...conditions))
    .orderBy(groups.sortOrder, groups.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toGroupResult);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  auth: AuthContext,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const [row] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
  }

  return toGroupResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const parsed = UpdateGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const rawBytes = Buffer.from(parsed.data.encryptedData, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(groups)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${groups.version} + 1`,
      })
      .where(
        and(
          eq(groups.id, groupId),
          eq(groups.systemId, systemId),
          eq(groups.version, parsed.data.version),
          eq(groups.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)),
        )
        .limit(1);

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "group.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group updated",
      systemId,
    });

    return toGroupResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    // Verify group exists
    const [existing] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
    }

    // Check for child groups
    const [childCount] = await tx
      .select({ count: count() })
      .from(groups)
      .where(
        and(
          eq(groups.parentGroupId, groupId),
          eq(groups.systemId, systemId),
          eq(groups.archived, false),
        ),
      );

    // Check for group memberships
    const [membershipCount] = await tx
      .select({ count: count() })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.systemId, systemId)));

    const children = childCount?.count ?? 0;
    const memberships = membershipCount?.count ?? 0;

    if (children > 0 || memberships > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Group has ${String(children)} child group(s) and ${String(memberships)} member(s). Remove all dependents before deleting.`,
      );
    }

    // Audit before delete (FK satisfied since group still exists)
    await audit(tx, {
      eventType: "group.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group deleted",
      systemId,
    });

    // Hard delete
    await tx.delete(groups).where(and(eq(groups.id, groupId), eq(groups.systemId, systemId)));
  });
}
