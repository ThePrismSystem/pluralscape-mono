import type { ImportEntityType, ImportError, ImportSourceFormat } from "@pluralscape/types";

/**
 * The result of a persister upsert call.
 *
 * `created`: a new Pluralscape entity was inserted.
 * `updated`: an existing Pluralscape entity (matched via the IdTranslationTable) was updated.
 * `skipped`: the persister determined no write was necessary (e.g., identical content).
 */
export interface PersisterUpsertResult {
  readonly action: "created" | "updated" | "skipped";
  readonly pluralscapeEntityId: string;
}

/**
 * A discriminated union of every entity shape the engine can hand the persister.
 *
 * Each variant carries the `entityType` discriminator and a typed `entity` payload
 * matching the corresponding Pluralscape entity row (minus IDs and tenant fields,
 * which the persister assigns).
 *
 * The payload type intentionally uses `unknown` here — the concrete payloads live
 * in the mapper output types in this package and are imported into the persister
 * implementation. Keeping the persister interface payload-agnostic prevents the
 * boundary from depending on every Pluralscape entity row type.
 */
export interface PersistableEntity {
  readonly entityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly source: ImportSourceFormat;
  readonly payload: unknown;
}

/**
 * Hook the engine uses to persist mapped entities and record errors.
 *
 * Implementations live outside this package (mobile glue in Plan 3, fakes in tests).
 * The engine never knows whether persistence is encrypted local SQLite, an in-memory
 * map, or a remote API.
 *
 * Contract:
 * - `upsertEntity` MUST be idempotent: calling it twice with the same source ID
 *   produces the same result. Implementations achieve this by consulting
 *   `import_entity_refs` before inserting.
 * - `recordError` MUST NOT throw — error recording must always succeed.
 * - `flush` is called at chunk boundaries; implementations should commit any
 *   buffered writes (e.g., batched ref upserts) before resolving.
 */
export interface Persister {
  upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}
