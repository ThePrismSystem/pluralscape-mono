import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { ImportCollectionType, ImportError } from "@pluralscape/types";

/** A single entity stored by the recording persister. */
export interface RecordedEntity {
  readonly entityType: ImportCollectionType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
  readonly payload: unknown;
}

/** Read-only snapshot returned by the recording persister. */
export interface RecordingSnapshot {
  /** All entities grouped by entity type. */
  entitiesByType(entityType: ImportCollectionType): readonly RecordedEntity[];
  /** Find a single entity by type and source ID. */
  find(entityType: ImportCollectionType, sourceEntityId: string): RecordedEntity | undefined;
  /** Count entities of a given type. */
  count(entityType: ImportCollectionType): number;
  /** All recorded errors. */
  readonly errors: readonly ImportError[];
}

/** Return value of `createRecordingPersister`. */
export interface RecordingPersister {
  readonly persister: Persister;
  readonly snapshot: () => RecordingSnapshot;
}

/**
 * Build a recording persister for E2E tests.
 *
 * Unlike `InMemoryPersister`, this variant has no error injection, no content
 * hashing, and always returns `"created"`. It exposes a `snapshot()` for
 * assertions.
 */
export function createRecordingPersister(): RecordingPersister {
  let idCounter = 0;
  const store = new Map<string, RecordedEntity>();
  const errors: ImportError[] = [];

  function storageKey(entityType: string, sourceEntityId: string): string {
    return `${entityType}:${sourceEntityId}`;
  }

  const persister: Persister = {
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      const key = storageKey(entity.entityType, entity.sourceEntityId);
      const existing = store.get(key);
      if (existing !== undefined) {
        return Promise.resolve({
          action: "created",
          pluralscapeEntityId: existing.pluralscapeEntityId,
        });
      }
      idCounter += 1;
      const pluralscapeEntityId = `e2e_${String(idCounter)}`;
      store.set(key, {
        entityType: entity.entityType,
        sourceEntityId: entity.sourceEntityId,
        pluralscapeEntityId,
        payload: entity.payload,
      });
      return Promise.resolve({ action: "created", pluralscapeEntityId });
    },
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    flush(): Promise<void> {
      return Promise.resolve();
    },
  };

  return {
    persister,
    snapshot(): RecordingSnapshot {
      return {
        entitiesByType(entityType: ImportCollectionType): readonly RecordedEntity[] {
          const result: RecordedEntity[] = [];
          for (const entity of store.values()) {
            if (entity.entityType === entityType) {
              result.push(entity);
            }
          }
          return result;
        },
        find(entityType: ImportCollectionType, sourceEntityId: string): RecordedEntity | undefined {
          return store.get(storageKey(entityType, sourceEntityId));
        },
        count(entityType: ImportCollectionType): number {
          let n = 0;
          for (const entity of store.values()) {
            if (entity.entityType === entityType) {
              n += 1;
            }
          }
          return n;
        },
        errors: [...errors],
      };
    },
  };
}
