/**
 * Mobile implementation of the `@pluralscape/import-sp` `Persister`
 * boundary.
 *
 * Responsibilities:
 *
 * - Seed an in-memory `IdTranslationTable` from caller-supplied preload
 *   hints (populated from `importEntityRef.lookupBatch` before
 *   construction). Resumes pick up existing refs this way.
 * - Dispatch `upsertEntity` calls through `PERSISTER_DISPATCH`, routing
 *   to `create` when no existing ID is cached and `update` otherwise.
 * - Batch-flush new source→target mappings to
 *   `importEntityRef.upsertBatch` when the ref queue crosses
 *   `PERSISTER_REF_BATCH_SIZE`.
 * - Accumulate non-fatal errors so the runner can drain them at chunk
 *   boundaries and push them into `importJob.update({ errorLog })`.
 */

import { PERSISTER_REF_BATCH_SIZE } from "./import-sp-mobile.constants.js";
import { PERSISTER_DISPATCH } from "./persister/persister-dispatch.js";

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
 * Shape of a single source→target mapping the caller supplies to seed
 * the IdTranslationTable. Usually produced by a prior call to
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
 * `drainErrors` method the runner uses at chunk boundaries to flush
 * the accumulated error list into `importJob.update({ errorLog })`.
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
 */
export function createMobilePersister(args: CreateMobilePersisterArgs): MobilePersister {
  const idTranslation = createIdTranslationTable(args.preloadHints);
  const refQueue: QueuedRefUpsert[] = [];
  const errorLog: ImportError[] = [];

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

  async function flushRefQueueBatches(): Promise<void> {
    while (refQueue.length >= PERSISTER_REF_BATCH_SIZE) {
      const batch = refQueue.splice(0, PERSISTER_REF_BATCH_SIZE);
      await args.api.importEntityRef.upsertBatch(args.systemId, {
        source: args.source,
        refs: batch,
      });
    }
  }

  async function upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
    const helper = PERSISTER_DISPATCH[entity.entityType];
    const existingId = idTranslation.get(entity.entityType, entity.sourceEntityId);

    if (existingId !== null) {
      const result = await helper.update(ctx, entity.payload, existingId);
      return { action: "updated", pluralscapeEntityId: result.pluralscapeEntityId };
    }

    const result = await helper.create(ctx, entity.payload);
    idTranslation.set(entity.entityType, entity.sourceEntityId, result.pluralscapeEntityId);
    ctx.queueRefUpsert(entity.entityType, entity.sourceEntityId, result.pluralscapeEntityId);
    await flushRefQueueBatches();
    return { action: "created", pluralscapeEntityId: result.pluralscapeEntityId };
  }

  return {
    upsertEntity,
    recordError(error: ImportError): Promise<void> {
      errorLog.push(error);
      return Promise.resolve();
    },
    async flush(): Promise<void> {
      await flushRefQueueBatches();
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
