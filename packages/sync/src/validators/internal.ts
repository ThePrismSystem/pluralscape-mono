/**
 * Shared types and helpers used across the post-merge validators.
 *
 * The validators rely on dynamic runtime field access via ENTITY_FIELD_MAP —
 * entity types are determined at runtime from ENTITY_CRDT_STRATEGIES, so a
 * union type cannot be narrowed meaningfully here. `Record<string, unknown>`
 * is the correct type for this pattern of structural duck-typing.
 */

import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";

import type { SyncedEntityType } from "../strategies/crdt-strategies.js";
import type * as Automerge from "@automerge/automerge";

export type DocRecord = Record<string, unknown>;

export interface ArchivableEntity {
  archived: boolean;
}

export interface ParentableEntity {
  id: Automerge.ImmutableString;
}

export interface SortableEntity {
  id: Automerge.ImmutableString;
  sortOrder: number;
  createdAt: number;
  [key: string]: unknown;
}

/** Typed accessor for a nested entity map within an Automerge document. */
export function getEntityMap<T>(doc: DocRecord, field: string): Record<string, T> | undefined {
  const val = doc[field];
  if (val !== null && typeof val === "object") {
    return val as Record<string, T>;
  }
  return undefined;
}

/**
 * Extracts the parent ID string from an entity's parent field. Handles
 * ImmutableString unwrapping and null/undefined values.
 */
export function getParentId(
  entity: Record<string, Automerge.ImmutableString | null> | undefined,
  parentField: string,
): string | null {
  const parentVal = entity?.[parentField];
  if (parentVal !== null && parentVal !== undefined && typeof parentVal === "object") {
    return parentVal.val;
  }
  return null;
}

/** Maps CRDT entity type names to their field names in Automerge documents. */
export const ENTITY_FIELD_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(ENTITY_CRDT_STRATEGIES).map(([type, strat]) => [type, strat.fieldName]),
);

/** Reverse map: document field name → entity type. */
const FIELD_TO_ENTITY_TYPE: ReadonlyMap<string, SyncedEntityType> = new Map(
  Object.entries(ENTITY_CRDT_STRATEGIES).map(
    ([type, strat]) => [strat.fieldName, type as SyncedEntityType] as const,
  ),
);

/**
 * Look up the entity type whose CRDT strategy stores entities under the given
 * top-level Automerge field name. Returns `undefined` when the field is not
 * backed by a synced entity (e.g. non-entity fields, or fields owned by a
 * different document topology).
 */
export function getEntityTypeByFieldName(fieldName: string): SyncedEntityType | undefined {
  return FIELD_TO_ENTITY_TYPE.get(fieldName);
}
