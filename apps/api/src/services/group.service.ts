import { groupMemberships, groups } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  CopyGroupBodySchema,
  CreateGroupBodySchema,
  MoveGroupBodySchema,
  ReorderGroupsBodySchema,
  UpdateGroupBodySchema,
} from "@pluralscape/validation";
import { and, eq, max, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { detectAncestorCycle } from "../lib/hierarchy.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

import { createHierarchyService } from "./hierarchy-service-factory.js";
import { mapBaseFields } from "./hierarchy-service-helpers.js";

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
    ...mapBaseFields(row),
    id: row.id as GroupId,
    parentGroupId: row.parentGroupId as GroupId | null,
    sortOrder: row.sortOrder,
  };
}

// ── Shared hierarchy service ────────────────────────────────────────

const groupHierarchy = createHierarchyService<
  {
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
  },
  GroupId,
  GroupResult
>({
  table: groups,
  columns: {
    id: groups.id,
    systemId: groups.systemId,
    parentId: groups.parentGroupId,
    encryptedData: groups.encryptedData,
    version: groups.version,
    archived: groups.archived,
    archivedAt: groups.archivedAt,
    createdAt: groups.createdAt,
    updatedAt: groups.updatedAt,
  },
  idPrefix: ID_PREFIXES.group,
  entityName: "Group",
  parentFieldName: "parentGroupId",
  toResult: toGroupResult,
  createSchema: CreateGroupBodySchema,
  updateSchema: UpdateGroupBodySchema,
  createInsertValues: (parsed) => ({
    sortOrder: parsed.sortOrder,
  }),
  updateSetValues: () => ({}),
  dependentChecks: [
    {
      table: groups,
      entityColumn: groups.parentGroupId,
      systemColumn: groups.systemId,
      label: "child group(s)",
      filterArchived: groups.archived,
    },
    {
      table: groupMemberships,
      entityColumn: groupMemberships.groupId,
      systemColumn: groupMemberships.systemId,
      label: "member(s)",
    },
  ],
  events: {
    created: "group.created",
    updated: "group.updated",
    deleted: "group.deleted",
    archived: "group.archived",
    restored: "group.restored",
  },
});

// ── Delegated CRUD ──────────────────────────────────────────────────

export const createGroup = groupHierarchy.create;

export const listGroups: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
) => Promise<PaginatedResult<GroupResult>> = groupHierarchy.list;

export const getGroup = groupHierarchy.get;

export const updateGroup = groupHierarchy.update;

export const deleteGroup = groupHierarchy.remove;

export const archiveGroup = groupHierarchy.archive;

export const restoreGroup = groupHierarchy.restore;

// ── MOVE ────────────────────────────────────────────────────────────

export async function moveGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(systemId, auth);

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
      await detectAncestorCycle(
        async (id) => {
          const [row] = await tx
            .select({ parentGroupId: groups.parentGroupId })
            .from(groups)
            .where(and(eq(groups.id, id), eq(groups.systemId, systemId)))
            .limit(1);
          return row?.parentGroupId;
        },
        targetParentGroupId,
        groupId,
        "Group",
      );
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

// ── COPY ────────────────────────────────────────────────────────────

export async function copyGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CopyGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid copy payload");
  }

  const timestamp = now();

  return db.transaction(async (tx) => {
    // Fetch source group
    const [source] = await tx
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!source) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source group not found");
    }

    // Determine target parent — use provided value or default to same parent as source
    const targetParentGroupId =
      parsed.data.targetParentGroupId !== undefined
        ? parsed.data.targetParentGroupId
        : source.parentGroupId;

    // Validate target parent if non-null
    if (targetParentGroupId !== null) {
      const [target] = await tx
        .select({ id: groups.id })
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
    }

    // Compute sort order: max among siblings + 1
    const parentCondition =
      targetParentGroupId === null
        ? sql`${groups.parentGroupId} IS NULL`
        : eq(groups.parentGroupId, targetParentGroupId);

    const [maxResult] = await tx
      .select({ maxSort: max(groups.sortOrder) })
      .from(groups)
      .where(and(eq(groups.systemId, systemId), parentCondition, eq(groups.archived, false)));

    const sortOrder = (maxResult?.maxSort ?? -1) + 1;

    // Insert new group
    const newGroupId = createId(ID_PREFIXES.group);
    const [row] = await tx
      .insert(groups)
      .values({
        id: newGroupId,
        systemId,
        parentGroupId: targetParentGroupId,
        sortOrder,
        encryptedData: source.encryptedData,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to copy group — INSERT returned no rows");
    }

    // Optionally copy memberships
    if (parsed.data.copyMemberships) {
      const memberships = await tx
        .select({
          memberId: groupMemberships.memberId,
        })
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.systemId, systemId)));

      if (memberships.length > 0) {
        await tx.insert(groupMemberships).values(
          memberships.map((m) => ({
            groupId: newGroupId,
            memberId: m.memberId,
            systemId,
            createdAt: timestamp,
          })),
        );
      }
    }

    await audit(tx, {
      eventType: "group.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Group copied from ${groupId}`,
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
  assertSystemOwnership(systemId, auth);

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
  assertSystemOwnership(systemId, auth);

  const parsed = ReorderGroupsBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid reorder payload");
  }

  await db.transaction(async (tx) => {
    // Pre-flight: verify all target groups exist and are active
    const groupIds = parsed.data.operations.map((op) => op.groupId);
    const existing = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.systemId, systemId), eq(groups.archived, false)));
    const existingIds = new Set(existing.map((g) => g.id));
    for (const gid of groupIds) {
      if (!existingIds.has(gid)) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `Group ${gid} not found`);
      }
    }

    const results = await Promise.all(
      parsed.data.operations.map((op) =>
        tx
          .update(groups)
          .set({ sortOrder: op.sortOrder })
          .where(
            and(
              eq(groups.id, op.groupId),
              eq(groups.systemId, systemId),
              eq(groups.archived, false),
            ),
          )
          .returning({ id: groups.id }),
      ),
    );

    const ops = parsed.data.operations;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const op = ops[i];
      if ((!result || result.length === 0) && op) {
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
