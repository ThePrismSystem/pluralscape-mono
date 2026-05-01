import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";

import { getEntityMap, getParentId, type DocRecord, type ParentableEntity } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { CycleBreak, EncryptedChangeEnvelope } from "../types.js";
import type * as Automerge from "@automerge/automerge";

/**
 * Generic cycle detection for a given entity field and parent field.
 * Returns pending clears (entityId + parentField to null) without mutating the session.
 */
function detectCyclesForField(
  doc: DocRecord,
  fieldName: string,
  parentField: string,
): Array<{ fieldName: string; parentField: string; entityId: string; formerParentId: string }> {
  const entityMap = getEntityMap<
    ParentableEntity & Record<string, Automerge.ImmutableString | null>
  >(doc, fieldName);
  if (!entityMap) return [];

  const pendingClears: Array<{
    fieldName: string;
    parentField: string;
    entityId: string;
    formerParentId: string;
  }> = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const entityId of Object.keys(entityMap)) {
    if (visited.has(entityId)) continue;

    const path: string[] = [];
    let current: string | null = entityId;

    while (current !== null && !visited.has(current)) {
      if (inStack.has(current)) {
        const cycleStart = path.indexOf(current);
        const cycle = path.slice(cycleStart);
        cycle.push(current);

        const lowestId = cycle.sort()[0];
        if (lowestId !== undefined) {
          const entity = entityMap[lowestId];
          const parentId = getParentId(entity, parentField);
          if (parentId !== null) {
            pendingClears.push({
              fieldName,
              parentField,
              entityId: lowestId,
              formerParentId: parentId,
            });
          }
        }
        break;
      }

      inStack.add(current);
      path.push(current);

      const currentEntity = entityMap[current];
      current = getParentId(currentEntity, parentField);

      if (current !== null && !(current in entityMap)) {
        current = null;
      }
    }

    for (const id of path) {
      visited.add(id);
      inStack.delete(id);
    }
  }

  return pendingClears;
}

/**
 * DFS on hierarchical entity parent chains (derived from strategies with parentField).
 * Break cycles by nulling the parent of the lowest-ID entity (deterministic).
 *
 * Returns cycle breaks and the correction envelope (if any mutations were applied).
 */
export function detectHierarchyCycles(session: EncryptedSyncSession<unknown>): {
  breaks: CycleBreak[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const allPendingClears: Array<{
    fieldName: string;
    parentField: string;
    entityId: string;
    formerParentId: string;
  }> = [];

  for (const [, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
    if ("parentField" in strategy) {
      const clears = detectCyclesForField(doc, strategy.fieldName, strategy.parentField);
      allPendingClears.push(...clears);
    }
  }

  if (allPendingClears.length === 0) {
    return { breaks: [], envelope: null };
  }

  const envelope = session.change((d) => {
    const docMap = d as DocRecord;
    for (const { fieldName, parentField, entityId } of allPendingClears) {
      const map = getEntityMap<Record<string, Automerge.ImmutableString | null>>(docMap, fieldName);
      const target = map?.[entityId];
      if (target) {
        target[parentField] = null;
      }
    }
  });

  const breaks = allPendingClears.map(({ entityId, formerParentId }) => ({
    entityId,
    formerParentId,
  }));

  return { breaks, envelope };
}
