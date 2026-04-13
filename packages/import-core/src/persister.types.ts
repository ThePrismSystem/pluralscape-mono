/**
 * Persister boundary types.
 *
 * `PersistableEntity` is a generic interface — the `entityType` tag and
 * `payload` are loosely typed here. Source-specific packages (import-sp,
 * import-pk) provide their own strongly-typed discriminated unions that extend
 * this interface.
 *
 * Field values are intentionally NOT a variant of the entity union: they are
 * handled inline by entity persisters rather than as standalone entities through
 * the engine's iteration loop.
 */
import type { ImportCollectionType, ImportError, ImportSourceFormat } from "@pluralscape/types";

interface PersistableEntityBase {
  readonly sourceEntityId: string;
  readonly source: ImportSourceFormat;
}

/**
 * A generic persistable entity carrying a collection-typed discriminator and
 * an opaque payload. Source-specific packages narrow `payload` to a typed
 * discriminated union for their entity types.
 */
export interface PersistableEntity extends PersistableEntityBase {
  readonly entityType: ImportCollectionType;
  readonly payload: unknown;
}

/**
 * The result of a persister upsert call.
 *
 * - `created`: a new Pluralscape entity was inserted.
 * - `updated`: an existing entity (matched via the IdTranslationTable) was updated.
 * - `skipped`: the persister determined no write was necessary (e.g., identical content).
 */
export type PersisterUpsertAction = "created" | "updated" | "skipped";

export interface PersisterUpsertResult {
  readonly action: PersisterUpsertAction;
  readonly pluralscapeEntityId: string;
}

/**
 * Hook the engine uses to persist mapped entities and record errors.
 *
 * Implementations live outside this package (mobile glue, fakes in tests).
 * The engine never knows whether persistence is encrypted local SQLite, an
 * in-memory map, or a remote API.
 *
 * Contract:
 * - `upsertEntity` MUST be idempotent keyed on `(entityType, sourceEntityId)`.
 *   Content-identical re-upserts SHOULD return `action: "skipped"` so the
 *   engine can report no-op work accurately.
 * - `recordError` MUST NOT throw — error recording must always succeed.
 * - `flush` is called at chunk boundaries; implementations should commit any
 *   buffered writes (e.g., batched ref upserts) before resolving.
 */
export interface Persister {
  upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}
