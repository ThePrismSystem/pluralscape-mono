import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";

import { getEntityMap, type DocRecord, type SortableEntity } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { EncryptedChangeEnvelope, SortOrderPatch } from "../types.js";

/** Pure computation: collect sort order patches for a single entity map. */
function collectSortOrderPatches<T extends SortableEntity>(
  entityMap: Record<string, T>,
  fieldName: string,
): Array<SortOrderPatch & { fieldName: string }> {
  const patches: Array<SortOrderPatch & { fieldName: string }> = [];
  const entities = Object.entries(entityMap);

  if (entities.length === 0) return patches;

  const sortOrders = entities.map(([, e]) => e.sortOrder);
  const uniqueOrders = new Set(sortOrders);

  if (uniqueOrders.size === sortOrders.length) {
    return patches;
  }

  const sorted = [...entities].sort(([idA, a], [idB, b]) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return idA.localeCompare(idB);
  });

  for (let i = 0; i < sorted.length; i++) {
    const [entityId, entity] = sorted[i] as [string, T];
    const newOrder = i + 1;

    if (entity.sortOrder !== newOrder) {
      patches.push({ entityId, newSortOrder: newOrder, fieldName });
    }
  }

  return patches;
}

/**
 * Partitions an entity map by a grouping field (e.g. parentEntityId).
 * Entities with the same group field value are placed in the same partition,
 * allowing sort order normalization to operate independently per group.
 */
function partitionByGroupField<T extends SortableEntity>(
  entityMap: Record<string, T>,
  groupField: string,
): Record<string, Record<string, T>> {
  const NULL_GROUP = "__null_group__";
  const partitions: Record<string, Record<string, T>> = {};

  for (const [id, entity] of Object.entries(entityMap)) {
    const groupValue: unknown = entity[groupField];
    let key: string;
    if (groupValue === null || groupValue === undefined) {
      key = NULL_GROUP;
    } else if (typeof groupValue === "object" && "val" in groupValue) {
      key = (groupValue as { val: string }).val;
    } else {
      key = NULL_GROUP;
    }

    partitions[key] ??= {};
    (partitions[key] as Record<string, T>)[id] = entity;
  }

  return partitions;
}

/**
 * For entities with sortOrder (derived from strategies with hasSortOrder), detect ties
 * and re-assign sequential values by createdAt then id.
 *
 * Returns patches and the correction envelope (if any mutations were applied).
 */
export function normalizeSortOrder(session: EncryptedSyncSession<unknown>): {
  patches: SortOrderPatch[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const allPatches: Array<SortOrderPatch & { fieldName: string }> = [];

  const sortableStrategies = Object.values(ENTITY_CRDT_STRATEGIES).filter(
    (s): s is typeof s & { hasSortOrder: true } => "hasSortOrder" in s,
  );

  for (const strategy of sortableStrategies) {
    const entityMap = getEntityMap<SortableEntity>(doc, strategy.fieldName);
    if (!entityMap) continue;

    if ("sortGroupField" in strategy && typeof strategy.sortGroupField === "string") {
      // Parent-scoped normalization: partition by group field, then normalize each group
      const partitions = partitionByGroupField(entityMap, strategy.sortGroupField);
      for (const partition of Object.values(partitions)) {
        allPatches.push(...collectSortOrderPatches(partition, strategy.fieldName));
      }
    } else {
      allPatches.push(...collectSortOrderPatches(entityMap, strategy.fieldName));
    }
  }

  if (allPatches.length === 0) {
    return { patches: [], envelope: null };
  }

  const envelope = session.change((d) => {
    const docMap = d as DocRecord;
    for (const { entityId, newSortOrder, fieldName } of allPatches) {
      const map = getEntityMap<SortableEntity>(docMap, fieldName);
      const target = map?.[entityId];
      if (target) {
        target.sortOrder = newSortOrder;
      }
    }
  });

  const patches = allPatches.map(({ entityId, newSortOrder }) => ({
    entityId,
    newSortOrder,
  }));

  return { patches, envelope };
}
