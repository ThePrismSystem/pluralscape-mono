import { groupMemberships, groups } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import {
  CreateGroupBodySchema,
  MoveGroupBodySchema,
  ReorderGroupsBodySchema,
  UpdateGroupBodySchema,
} from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/assert-system-ownership.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { MAX_ANCESTOR_DEPTH } from "../routes/groups/groups.constants.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

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

// ── CREATE ──────────────────────────────────────────────────────────

export async function createGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateGroupBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const groupId = createId(ID_PREFIXES.group);
  const timestamp = now();

  return db.transaction(async (tx) => {
    // Validate parentGroupId exists in same system if non-null
    if (parsed.parentGroupId !== null) {
      const [parent] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(
            eq(groups.id, parsed.parentGroupId),
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
        parentGroupId: parsed.parentGroupId,
        sortOrder: parsed.sortOrder,
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
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<GroupResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  const conditions = [eq(groups.systemId, systemId), eq(groups.archived, false)];

  if (cursor) {
    conditions.push(gt(groups.id, cursor));
  }

  const rows = await db
    .select()
    .from(groups)
    .where(and(...conditions))
    .orderBy(groups.id)
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

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateGroupBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

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
          eq(groups.version, parsed.version),
          eq(groups.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: groups.id })
          .from(groups)
          .where(
            and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Group",
    );

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

    if (!childCount || !membershipCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    const children = childCount.count;
    const memberships = membershipCount.count;

    if (children > 0 || memberships > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Group has ${String(children)} child group(s) and ${String(memberships)} member(s). Remove all dependents before deleting.`,
      );
    }

    // Audit before delete (FK satisfied since group still exists)
    await audit(tx, {
      eventType: "group.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group deleted",
      systemId,
    });

    // Hard delete
    await tx.delete(groups).where(and(eq(groups.id, groupId), eq(groups.systemId, systemId)));
  });
}

// ── MOVE ────────────────────────────────────────────────────────────

export async function moveGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const parsed = MoveGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid move payload");
  }

  const { targetParentGroupId } = parsed.data;

  // Reject self-parenting
  if (targetParentGroupId === groupId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Cannot set group as its own parent",
    );
  }

  const timestamp = now();

  return db.transaction(async (tx) => {
    // If targetParentGroupId non-null, verify it exists and is not archived
    if (targetParentGroupId !== null) {
      const [target] = await tx
        .select({ id: groups.id, parentGroupId: groups.parentGroupId })
        .from(groups)
        .where(
          and(
            eq(groups.id, targetParentGroupId),
            eq(groups.systemId, systemId),
            eq(groups.archived, false),
          ),
        )
        .limit(1);

      if (!target) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target parent group not found");
      }

      // Cycle detection: walk ancestors from target up; if we find groupId, it's circular
      let currentId: string | null = targetParentGroupId;
      for (let i = 0; i < MAX_ANCESTOR_DEPTH && currentId !== null; i++) {
        if (currentId === groupId) {
          throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Circular reference detected");
        }
        const [ancestor] = await tx
          .select({ parentGroupId: groups.parentGroupId })
          .from(groups)
          .where(and(eq(groups.id, currentId), eq(groups.systemId, systemId)))
          .limit(1);
        if (!ancestor) {
          throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Group hierarchy integrity violation");
        }
        currentId = ancestor.parentGroupId;
      }

      // If we exhausted the depth limit without reaching root, reject
      if (currentId !== null) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "CONFLICT",
          "Group hierarchy too deep or contains a cycle",
        );
      }
    }

    // OCC update
    const updated = await tx
      .update(groups)
      .set({
        parentGroupId: targetParentGroupId,
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

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: groups.id })
          .from(groups)
          .where(
            and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Group",
    );

    await audit(tx, {
      eventType: "group.moved",
      actor: { kind: "account", id: auth.accountId },
      detail: `Group moved to parent ${targetParentGroupId ?? "root"}`,
      systemId,
    });

    return toGroupResult(row);
  });
}

// ── TREE ────────────────────────────────────────────────────────────

export interface GroupResultTree extends GroupResult {
  readonly children: GroupResultTree[];
}

export async function getGroupTree(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<GroupResultTree[]> {
  assertSystemOwnership(auth, systemId);

  const rows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.systemId, systemId), eq(groups.archived, false)))
    .orderBy(groups.sortOrder);

  // Build tree in-memory
  const nodeMap = new Map<string, GroupResultTree>();
  const roots: GroupResultTree[] = [];

  for (const row of rows) {
    const node: GroupResultTree = { ...toGroupResult(row), children: [] };
    nodeMap.set(row.id, node);
  }

  for (const node of nodeMap.values()) {
    if (node.parentGroupId !== null) {
      const parent = nodeMap.get(node.parentGroupId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned — treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── REORDER ─────────────────────────────────────────────────────────

export async function reorderGroups(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  const parsed = ReorderGroupsBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid reorder payload");
  }

  await db.transaction(async (tx) => {
    for (const op of parsed.data.operations) {
      const updated = await tx
        .update(groups)
        .set({ sortOrder: op.sortOrder })
        .where(
          and(eq(groups.id, op.groupId), eq(groups.systemId, systemId), eq(groups.archived, false)),
        )
        .returning({ id: groups.id });

      if (updated.length === 0) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `Group ${op.groupId} not found`);
      }
    }

    await audit(tx, {
      eventType: "group.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(parsed.data.operations.length)} group(s)`,
      systemId,
    });
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
    }

    await tx
      .update(groups)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId)));

    await audit(tx, {
      eventType: "group.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group archived",
      systemId,
    });
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(auth, systemId);

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: groups.id, parentGroupId: groups.parentGroupId })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, true)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived group not found");
    }

    // If parent is archived, promote to root
    let newParentGroupId = existing.parentGroupId;
    if (newParentGroupId !== null) {
      const [parent] = await tx
        .select({ archived: groups.archived })
        .from(groups)
        .where(and(eq(groups.id, newParentGroupId), eq(groups.systemId, systemId)))
        .limit(1);

      if (!parent || parent.archived) {
        newParentGroupId = null;
      }
    }

    const updated = await tx
      .update(groups)
      .set({
        archived: false,
        archivedAt: null,
        parentGroupId: newParentGroupId,
        updatedAt: timestamp,
        version: sql`${groups.version} + 1`,
      })
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId)))
      .returning();

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Archived group not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "group.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Group restored",
      systemId,
    });

    return toGroupResult(row);
  });
}
