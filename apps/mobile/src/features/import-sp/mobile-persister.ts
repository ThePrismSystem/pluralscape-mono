/**
 * Mobile implementation of the `@pluralscape/import-sp` `Persister`
 * boundary.
 *
 * Assembles an `IdTranslationTable` seeded from preload hints (populated
 * from `importEntityRef.lookupBatch` before construction), a recorded-error
 * queue, and a batched ref upsert queue. The actual `upsertEntity`
 * dispatch table is wired in Task 16 — the skeleton here throws a
 * "dispatch not implemented" error so that the persister can be
 * constructed and its seeding exercised before the 17 helpers land.
 */

import { PERSISTER_REF_BATCH_SIZE } from "./import-sp-mobile.constants.js";

import type {
  IdTranslationTable,
  PersisterApi,
  PersisterContext,
} from "./persister/persister.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "@pluralscape/import-sp/persister-types";
import type { ImportError, ImportSource, SystemId } from "@pluralscape/types";

// ── Preload hint shape ───────────────────────────────────────────────

/**
 * Shape of a single source→target mapping the caller supplies to seed the
 * IdTranslationTable. Usually produced by a prior call to
 * `importEntityRef.lookupBatch`.
 */
export interface PreloadHint {
  readonly sourceEntityType: string;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

// ── Ref upsert queue entry ───────────────────────────────────────────

interface QueuedRefUpsert {
  readonly sourceEntityType: string;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

// ── createMobilePersister args ───────────────────────────────────────

/** Arguments for `createMobilePersister`. */
export interface CreateMobilePersisterArgs {
  readonly systemId: SystemId;
  readonly source: ImportSource;
  readonly masterKey: KdfMasterKey;
  readonly api: PersisterApi;
  readonly avatarFetcher: AvatarFetcher;
  /** Seed entries for the IdTranslationTable — typically from a prior lookupBatch call. */
  readonly preloadHints: readonly PreloadHint[];
}

// ── The persister interface this module produces ────────────────────

/**
 * Extended persister interface exposed to the import runner. Adds the
 * `drainErrors` method the runner uses at chunk boundaries to flush the
 * accumulated error list into `importJob.update({ errorLog })`.
 */
export interface MobilePersister extends Persister {
  drainErrors(): readonly ImportError[];
}

// ── Internal IdTranslationTable impl ─────────────────────────────────

function createIdTranslationTable(preload: readonly PreloadHint[]): IdTranslationTable {
  const store = new Map<string, string>();
  for (const hint of preload) {
    store.set(`${hint.sourceEntityType}:${hint.sourceEntityId}`, hint.pluralscapeEntityId);
  }
  return {
    get(sourceEntityType, sourceEntityId) {
      return store.get(`${sourceEntityType}:${sourceEntityId}`) ?? null;
    },
    set(sourceEntityType, sourceEntityId, pluralscapeEntityId) {
      store.set(`${sourceEntityType}:${sourceEntityId}`, pluralscapeEntityId);
    },
  };
}

// ── createMobilePersister ────────────────────────────────────────────

/**
 * Create the mobile `Persister` implementation.
 *
 * The engine calls `upsertEntity` per document, `recordError` on
 * non-fatal failures, and `flush` at chunk boundaries. The persister
 * buffers ref upserts up to `PERSISTER_REF_BATCH_SIZE` before flushing
 * them to `importEntityRef.upsertBatch` to minimise round trips.
 *
 * The dispatch table is wired in Task 16. Until then, `upsertEntity`
 * throws a `Persister dispatch not implemented` error — calling code that
 * exercises the preload seeding (tests, or the runner before any
 * entities are processed) can still construct the persister.
 */
export function createMobilePersister(args: CreateMobilePersisterArgs): MobilePersister {
  const idTranslation = createIdTranslationTable(args.preloadHints);
  const refQueue: QueuedRefUpsert[] = [];
  const errorLog: ImportError[] = [];

  // ctx is referenced here to hold the collaborators the dispatch table
  // will need in Task 16. Marked with `void` so the no-unused-vars lint
  // does not fire on the skeleton.
  const ctx: PersisterContext = {
    systemId: args.systemId,
    source: args.source,
    masterKey: args.masterKey,
    api: args.api,
    idTranslation,
    avatarFetcher: args.avatarFetcher,
    recordError(error) {
      errorLog.push(error);
    },
    queueRefUpsert(sourceEntityType, sourceEntityId, pluralscapeEntityId) {
      refQueue.push({ sourceEntityType, sourceEntityId, pluralscapeEntityId });
    },
  };
  void ctx;

  async function flushRefQueue(): Promise<void> {
    while (refQueue.length >= PERSISTER_REF_BATCH_SIZE) {
      const batch = refQueue.splice(0, PERSISTER_REF_BATCH_SIZE);
      await args.api.importEntityRef.upsertBatch(args.systemId, {
        source: args.source,
        refs: batch,
      });
    }
  }

  return {
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      return Promise.reject(
        new Error(
          `Persister dispatch not implemented for ${entity.entityType}:${entity.sourceEntityId}`,
        ),
      );
    },
    recordError(error: ImportError): Promise<void> {
      errorLog.push(error);
      return Promise.resolve();
    },
    async flush(): Promise<void> {
      await flushRefQueue();
      if (refQueue.length > 0) {
        const batch = refQueue.splice(0, refQueue.length);
        await args.api.importEntityRef.upsertBatch(args.systemId, {
          source: args.source,
          refs: batch,
        });
      }
    },
    drainErrors(): readonly ImportError[] {
      const drained = errorLog.splice(0, errorLog.length);
      return drained;
    },
  };
}
