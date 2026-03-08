import type { EntityType } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** Input for creating an entity — strips server-assigned fields. */
export type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt" | "version">;

/** Input for updating an entity — strips immutable fields, makes rest partial. */
export type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt">>;

/** Recursively makes all properties `readonly`. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** A time range bounded by two Unix timestamps. */
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

/** Sort direction for queries. */
export type SortDirection = "asc" | "desc";

/** A generic reference to any entity by type and ID. */
export interface EntityReference {
  readonly entityType: EntityType;
  readonly entityId: string;
}
