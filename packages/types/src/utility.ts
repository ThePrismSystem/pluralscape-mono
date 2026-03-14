import type { EntityType } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** Input for creating an entity — strips server-assigned fields. */
export type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt" | "version">;

/** Input for updating an entity — strips server-assigned fields, makes rest partial. */
export type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "version">>;

/** Recursively makes all properties `readonly`. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends Date
        ? Date
        : T extends (...args: never[]) => unknown
          ? T
          : T extends object
            ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;

/**
 * A time range bounded by two Unix timestamps.
 * Invariant: `start` must be <= `end`.
 */
export interface DateRange {
  readonly start: UnixMillis;
  readonly end: UnixMillis;
}

/** Common audit fields present on most persisted entities. */
export interface AuditMetadata {
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly version: number;
}

/**
 * Transforms an archivable entity type into its archived variant.
 * Replaces `archived: false` with `archived: true` and adds `archivedAt`.
 *
 * Note: Uses Omit which is non-distributive over unions. Archived<X | Y>
 * flattens to intersection of common keys. Each Archived<X> should be
 * defined separately. Narrowing still works on individually-defined aliases.
 */
export type Archived<T extends { readonly archived: false }> = Omit<T, "archived"> & {
  readonly archived: true;
  readonly archivedAt: UnixMillis;
};

/** Sort direction for queries. */
export type SortDirection = "asc" | "desc";

/**
 * A generic reference to any entity by type and ID.
 *
 * `entityId` is a plain `string` because a full EntityType→BrandedId
 * mapping is deferred to runtime utils.
 */
export interface EntityReference<T extends EntityType = EntityType> {
  readonly entityType: T;
  readonly entityId: string;
}
