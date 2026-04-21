import { groups } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { groupHierarchy, toGroupResult } from "./internal.js";

import type { GroupResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type { GroupResult } from "./internal.js";

export const listGroups: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit?: number,
  includeArchived?: boolean,
) => Promise<PaginatedResult<GroupResult>> = groupHierarchy.list;

export const getGroup: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: GroupId,
  auth: AuthContext,
) => Promise<GroupResult> = groupHierarchy.get;

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

  const rows = await withTenantRead(db, tenantCtx(systemId, auth), (tx) =>
    tx
      .select()
      .from(groups)
      .where(and(eq(groups.systemId, systemId), eq(groups.archived, false)))
      .orderBy(groups.sortOrder),
  );

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
