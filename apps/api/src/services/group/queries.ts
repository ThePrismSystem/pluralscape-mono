import { groups } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { groupHierarchy, toGroupResult } from "./internal.js";

import type { GroupResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type { GroupResult } from "./internal.js";

// Factory method re-exports — TS inference propagates cleanly now.
// Previously needed explicit type annotations (see api-5psf).
export const listGroups = groupHierarchy.list;
export const getGroup = groupHierarchy.get;

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
