/**
 * Per-collection iteration logic for the import engine.
 *
 * Extracted from `import-engine.ts` to keep the outer orchestrator file under
 * the area LOC ceiling. Both the batch-mapper and single-mapper paths live
 * here, plus the shared `persistMapperResult` step that converts a mapper
 * result into a checkpoint advance.
 *
 * All functions are package-internal — public consumers continue to import
 * from `import-engine.js`.
 */
import { advanceWithinCollection, bumpCollectionTotals, type AdvanceDelta } from "./checkpoint.js";
import { isFatalError } from "./engine-errors.js";
import { CHECKPOINT_CHUNK_SIZE } from "./import-core.constants.js";
import { buildPersistableEntity, delta, isAborted } from "./import-engine.helpers.js";
import { isBatchMapper, type MapperDispatchEntry, type SourceDocument } from "./mapper-dispatch.js";

import type { MappingContext } from "./context.js";
import type { ErrorClassifier } from "./engine-errors.js";
import type { MapperResult } from "./mapper-result.js";
import type { PersistableEntity, Persister, PersisterUpsertAction } from "./persister.types.js";
import type { ImportDataSource } from "./source.types.js";
import type {
  ImportCheckpointState,
  ImportCollectionType,
  ImportError,
  ImportSourceFormat,
} from "@pluralscape/types";

export type CheckpointStateRef = { current: ImportCheckpointState };

/** Per-run dependencies threaded through every collection iteration. */
export interface EngineRunContext {
  readonly source: ImportDataSource;
  readonly persister: Persister;
  readonly sourceFormat: ImportSourceFormat;
  readonly classify: ErrorClassifier;
  readonly ctx: MappingContext;
  readonly errors: ImportError[];
  readonly onProgress: (state: ImportCheckpointState) => Promise<void>;
  readonly abortSignal: AbortSignal | undefined;
}

const UPSERT_ACTION_TO_DELTA: Record<PersisterUpsertAction, AdvanceDelta> = {
  created: delta("imported"),
  updated: delta("updated"),
  skipped: delta("skipped"),
};

export type CollectionIterationOutcome =
  | { readonly kind: "completed"; readonly state: ImportCheckpointState }
  | { readonly kind: "aborted"; readonly state: ImportCheckpointState };

/**
 * Process a single mapper result (skipped/failed/mapped) through the
 * persist-and-checkpoint pipeline. Shared by both the batch and single
 * mapper paths to eliminate duplicated error-handling and upsert logic.
 *
 * Returns `true` when a fatal error aborted the collection.
 */
export async function persistMapperResult(
  rctx: EngineRunContext,
  result: MapperResult<unknown>,
  sourceEntityId: string,
  entityType: ImportCollectionType,
  persistedSourceIds: string[],
  stateRef: CheckpointStateRef,
): Promise<boolean> {
  const { persister, ctx, classify, sourceFormat, errors } = rctx;

  if (result.status === "skipped") {
    stateRef.current = advanceWithinCollection(stateRef.current, {
      entityType,
      lastSourceId: sourceEntityId,
      delta: delta("skipped"),
    });
    return false;
  }

  if (result.status === "failed") {
    const error: ImportError = {
      entityType,
      entityId: sourceEntityId,
      message: result.message,
      kind: result.kind,
      fatal: false,
    };
    errors.push(error);
    try {
      await persister.recordError(error);
    } catch {
      /* contract violation — swallow */
    }
    stateRef.current = advanceWithinCollection(stateRef.current, {
      entityType,
      lastSourceId: sourceEntityId,
      delta: delta("failed"),
    });
    return false;
  }

  // status === "mapped"
  try {
    const entity: PersistableEntity = buildPersistableEntity(
      entityType,
      sourceEntityId,
      sourceFormat,
      result.payload,
    );
    const upsert = await persister.upsertEntity(entity);
    ctx.register(entityType, sourceEntityId, upsert.pluralscapeEntityId);
    persistedSourceIds.push(sourceEntityId);
    stateRef.current = advanceWithinCollection(stateRef.current, {
      entityType,
      lastSourceId: sourceEntityId,
      delta: UPSERT_ACTION_TO_DELTA[upsert.action],
    });
  } catch (thrown) {
    const error = classify(thrown, { entityType, entityId: sourceEntityId });
    errors.push(error);
    await persister.recordError(error);
    if (isFatalError(error)) {
      return true;
    }
    stateRef.current = advanceWithinCollection(stateRef.current, {
      entityType,
      lastSourceId: sourceEntityId,
      delta: delta("failed"),
    });
  }
  return false;
}

interface DropAdvance {
  readonly state: ImportCheckpointState;
  readonly docsSinceCheckpoint: number;
}

/** Apply a drop event to checkpoint state and report the new docsSinceCheckpoint. */
async function applyDropEvent(
  rctx: EngineRunContext,
  entityType: ImportCollectionType,
  sourceId: string | null,
  reason: string,
  state: ImportCheckpointState,
  docsSinceCheckpoint: number,
): Promise<DropAdvance> {
  const error: ImportError = {
    entityType,
    entityId: sourceId,
    message: reason,
    kind: "invalid-source-document",
    fatal: false,
  };
  rctx.errors.push(error);
  await rctx.persister.recordError(error);
  const nextState =
    sourceId !== null
      ? advanceWithinCollection(state, {
          entityType,
          lastSourceId: sourceId,
          delta: delta("failed"),
        })
      : bumpCollectionTotals(state, entityType, delta("failed"));
  let nextDocs = docsSinceCheckpoint + 1;
  if (nextDocs >= CHECKPOINT_CHUNK_SIZE) {
    await rctx.persister.flush();
    await rctx.onProgress(nextState);
    nextDocs = 0;
  }
  return { state: nextState, docsSinceCheckpoint: nextDocs };
}

/**
 * Wrap source iteration errors as a fatal `ImportError`. Source iteration
 * itself throwing is always fatal regardless of the underlying error type
 * because there is no way to continue iterating a generator that has thrown.
 */
async function recordIterationError(
  rctx: EngineRunContext,
  entityType: ImportCollectionType,
  thrown: unknown,
): Promise<void> {
  const classified = rctx.classify(thrown, { entityType, entityId: null });
  const error: ImportError = classified.fatal
    ? classified
    : {
        entityType: classified.entityType,
        entityId: classified.entityId,
        message: classified.message,
        fatal: true,
        recoverable: true,
      };
  rctx.errors.push(error);
  await rctx.persister.recordError(error);
}

/** Batch mapper path: accumulate all documents, then map in bulk. */
export async function runBatchCollection(
  rctx: EngineRunContext,
  entry: MapperDispatchEntry,
  collection: string,
  entityType: ImportCollectionType,
  initialState: ImportCheckpointState,
  resumeCutoffSourceId: string | null,
  persistedSourceIds: string[],
): Promise<CollectionIterationOutcome & { readonly pastResumeCutoff: boolean }> {
  if (!isBatchMapper(entry)) {
    throw new Error("runBatchCollection called with non-batch mapper entry");
  }

  let state = initialState;
  let docsSinceCheckpoint = 0;
  let pastResumeCutoff = resumeCutoffSourceId === null;

  try {
    const accumulated: SourceDocument[] = [];

    for await (const event of rctx.source.iterate(collection)) {
      if (isAborted(rctx.abortSignal)) {
        return { kind: "aborted", state, pastResumeCutoff };
      }

      if (!pastResumeCutoff) {
        if (event.sourceId === resumeCutoffSourceId) {
          pastResumeCutoff = true;
        }
        continue;
      }

      if (event.kind === "drop") {
        const advance = await applyDropEvent(
          rctx,
          entityType,
          event.sourceId,
          event.reason,
          state,
          docsSinceCheckpoint,
        );
        state = advance.state;
        docsSinceCheckpoint = advance.docsSinceCheckpoint;
        continue;
      }

      accumulated.push({ sourceId: event.sourceId, document: event.document });
    }

    // Process all accumulated documents in a single batch call.
    const batchResults = entry.mapBatch(accumulated, rctx.ctx);

    const stateRef: CheckpointStateRef = { current: state };
    for (const batchItem of batchResults) {
      if (isAborted(rctx.abortSignal)) {
        return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
      }

      const fatal = await persistMapperResult(
        rctx,
        batchItem.result,
        batchItem.sourceEntityId,
        entityType,
        persistedSourceIds,
        stateRef,
      );
      if (fatal) {
        return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
      }

      docsSinceCheckpoint += 1;
      if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
        await rctx.persister.flush();
        await rctx.onProgress(stateRef.current);
        docsSinceCheckpoint = 0;
      }
    }
    state = stateRef.current;
  } catch (thrown) {
    await recordIterationError(rctx, entityType, thrown);
    return { kind: "aborted", state, pastResumeCutoff };
  }

  return { kind: "completed", state, pastResumeCutoff };
}

/** Single mapper path: process documents one at a time as the source yields them. */
export async function runSingleCollection(
  rctx: EngineRunContext,
  entry: MapperDispatchEntry,
  collection: string,
  entityType: ImportCollectionType,
  initialState: ImportCheckpointState,
  resumeCutoffSourceId: string | null,
  persistedSourceIds: string[],
): Promise<CollectionIterationOutcome & { readonly pastResumeCutoff: boolean }> {
  if (isBatchMapper(entry)) {
    throw new Error("runSingleCollection called with batch mapper entry");
  }

  let docsSinceCheckpoint = 0;
  let pastResumeCutoff = resumeCutoffSourceId === null;
  const stateRef: CheckpointStateRef = { current: initialState };

  try {
    for await (const event of rctx.source.iterate(collection)) {
      if (!pastResumeCutoff) {
        if (event.sourceId === resumeCutoffSourceId) {
          pastResumeCutoff = true;
        }
        continue;
      }

      if (event.kind === "drop") {
        const advance = await applyDropEvent(
          rctx,
          entityType,
          event.sourceId,
          event.reason,
          stateRef.current,
          docsSinceCheckpoint,
        );
        stateRef.current = advance.state;
        docsSinceCheckpoint = advance.docsSinceCheckpoint;
        if (isAborted(rctx.abortSignal)) {
          return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
        }
        continue;
      }

      const result = entry.map(event.document, rctx.ctx);

      const fatal = await persistMapperResult(
        rctx,
        result,
        event.sourceId,
        entityType,
        persistedSourceIds,
        stateRef,
      );
      if (fatal) {
        return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
      }

      docsSinceCheckpoint += 1;
      if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
        await rctx.persister.flush();
        await rctx.onProgress(stateRef.current);
        docsSinceCheckpoint = 0;
      }

      if (isAborted(rctx.abortSignal)) {
        return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
      }
    }
  } catch (thrown) {
    await recordIterationError(rctx, entityType, thrown);
    return { kind: "aborted", state: stateRef.current, pastResumeCutoff };
  }

  return { kind: "completed", state: stateRef.current, pastResumeCutoff };
}
