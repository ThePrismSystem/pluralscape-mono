/**
 * In-memory `Persister` implementation for integration tests.
 *
 * Stores every upserted entity keyed by `entityType:sourceEntityId`, records
 * every error without throwing, and assigns deterministic Pluralscape IDs of
 * the form `ps_<counter>_<entityType>_<sourceEntityId>` so tests can assert
 * exact mappings registered in the `IdTranslationTable`.
 *
 * Contract parity with the production persister:
 *  - `upsertEntity` is idempotent per `(entityType, sourceEntityId)`. The first
 *    call returns `created`; subsequent calls with the same key return
 *    `updated` and overwrite the stored payload.
 *  - `recordError` always resolves. Errors are accumulated in the returned
 *    `errors` array.
 *  - `flush` increments a counter so tests can assert chunk boundaries.
 */
import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { ImportEntityType, ImportError } from "@pluralscape/types";

/** A single entity stored in the in-memory persister. */
export interface StoredEntity {
  readonly entityType: ImportEntityType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
  readonly payload: unknown;
}

/** Snapshot of the in-memory persister's state for test assertions. */
export interface InMemoryPersisterSnapshot {
  readonly size: number;
  readonly entities: readonly StoredEntity[];
  readonly errors: readonly ImportError[];
  readonly flushCount: number;
  /** Count entities of a given type. */
  readonly countByType: (entityType: ImportEntityType) => number;
  /** True iff at least one entity of the given type was upserted. */
  readonly hasType: (entityType: ImportEntityType) => boolean;
  /** Lookup a single stored entity by type and source id. */
  readonly find: (entityType: ImportEntityType, sourceEntityId: string) => StoredEntity | undefined;
}

/** Return value of `createInMemoryPersister`. */
export interface InMemoryPersister {
  readonly persister: Persister;
  readonly snapshot: () => InMemoryPersisterSnapshot;
}

function storageKey(entityType: ImportEntityType, sourceEntityId: string): string {
  return `${entityType}:${sourceEntityId}`;
}

/**
 * Build a fresh in-memory persister. Each call returns an isolated instance so
 * tests can share the helper without interfering with one another.
 */
export function createInMemoryPersister(): InMemoryPersister {
  const store = new Map<string, StoredEntity>();
  const errors: ImportError[] = [];
  let counter = 0;
  let flushCount = 0;

  const persister: Persister = {
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      const key = storageKey(entity.entityType, entity.sourceEntityId);
      const existing = store.get(key);
      if (existing) {
        const updated: StoredEntity = {
          entityType: entity.entityType,
          sourceEntityId: entity.sourceEntityId,
          pluralscapeEntityId: existing.pluralscapeEntityId,
          payload: entity.payload,
        };
        store.set(key, updated);
        return Promise.resolve({
          action: "updated",
          pluralscapeEntityId: existing.pluralscapeEntityId,
        });
      }
      counter += 1;
      const pluralscapeEntityId = `ps_${String(counter)}_${key}`;
      const stored: StoredEntity = {
        entityType: entity.entityType,
        sourceEntityId: entity.sourceEntityId,
        pluralscapeEntityId,
        payload: entity.payload,
      };
      store.set(key, stored);
      return Promise.resolve({ action: "created", pluralscapeEntityId });
    },
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    flush(): Promise<void> {
      flushCount += 1;
      return Promise.resolve();
    },
  };

  return {
    persister,
    snapshot(): InMemoryPersisterSnapshot {
      const entities = [...store.values()];
      return {
        size: entities.length,
        entities,
        errors: [...errors],
        flushCount,
        countByType: (entityType) => entities.filter((e) => e.entityType === entityType).length,
        hasType: (entityType) => entities.some((e) => e.entityType === entityType),
        find: (entityType, sourceEntityId) => store.get(storageKey(entityType, sourceEntityId)),
      };
    },
  };
}
