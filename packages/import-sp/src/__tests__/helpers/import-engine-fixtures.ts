import type { Persister, PersistableEntity } from "../../persistence/persister.types.js";
import type { ImportDataSource, SourceEvent } from "../../sources/source.types.js";
import type { ImportCollectionType, ImportError } from "@pluralscape/types";

export interface RecordingPersister extends Persister {
  readonly upserted: readonly PersistableEntity[];
  readonly errors: readonly ImportError[];
  readonly flushCount: number;
}

export interface CreateFakePersisterOptions {
  /**
   * Optional override that lets a single upsert call throw — keyed by source
   * entity ID. Used by error-path tests.
   */
  readonly throwOn?: Readonly<Record<string, Error>>;
}

export function createFakePersister(opts: CreateFakePersisterOptions = {}): RecordingPersister {
  const upserted: PersistableEntity[] = [];
  const errors: ImportError[] = [];
  let flushCount = 0;
  let nextId = 1;
  const throwOn = opts.throwOn ?? {};
  return {
    get upserted(): readonly PersistableEntity[] {
      return upserted;
    },
    get errors(): readonly ImportError[] {
      return errors;
    },
    get flushCount(): number {
      return flushCount;
    },
    upsertEntity(entity) {
      const maybeError = throwOn[entity.sourceEntityId];
      if (maybeError !== undefined) return Promise.reject(maybeError);
      upserted.push(entity);
      const id = `ps-${String(nextId++)}`;
      return Promise.resolve({ action: "created" as const, pluralscapeEntityId: id });
    },
    recordError(error) {
      errors.push(error);
      return Promise.resolve();
    },
    flush() {
      flushCount += 1;
      return Promise.resolve();
    },
  };
}

export function stubSource(
  events: readonly SourceEvent[],
  collections: readonly string[] = ["members"],
): ImportDataSource {
  return {
    mode: "fake",
    async *iterate(collection) {
      for (const e of events) {
        if (e.collection !== collection) continue;
        await Promise.resolve();
        yield e;
      }
    },
    listCollections() {
      return Promise.resolve(collections);
    },
    close() {
      return Promise.resolve();
    },
  };
}

export const noopProgress = (): Promise<void> => Promise.resolve();

export const ALL_CATEGORIES_ON: Partial<Record<ImportCollectionType, boolean>> = {
  "system-profile": true,
  "system-settings": true,
  "privacy-bucket": true,
  "field-definition": true,
  "custom-front": true,
  member: true,
  group: true,
  "fronting-session": true,
  "fronting-comment": true,
  "journal-entry": true,
  poll: true,
  "channel-category": true,
  channel: true,
  "chat-message": true,
  "board-message": true,
};
