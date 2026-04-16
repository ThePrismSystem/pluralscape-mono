/**
 * Generic import engine orchestrator.
 *
 * Walks `args.dependencyOrder`, dispatches each document through the
 * `args.mapperDispatch` table (supporting both single-document and batch
 * mappers), persists `mapped` results via the injected `Persister`, records
 * non-fatal failures, and aborts on fatal transport or parse errors with a
 * recoverable checkpoint preserved.
 *
 * Public surface:
 *  - {@link runImportEngine} — the orchestrator entry point.
 *  - {@link RunImportEngineArgs}, {@link ImportRunResult} — argument and result
 *    shapes the API service uses to bridge the engine to `import_jobs`.
 *  - {@link buildPersistableEntity} — narrowing helper for dispatch results.
 *
 * Design notes:
 *  - The engine is source-agnostic. Source-specific behaviour (SP legacy
 *    bucket synthesis, PK switch-to-fronting conversion) is injected via the
 *    `beforeCollection` hook.
 *  - Batch mappers receive ALL documents for a collection at once, enabling
 *    cross-document analysis (e.g., PK switches → fronting sessions).
 *  - Checkpoint state is keyed by `ImportCollectionType`, not source-specific
 *    collection names. The engine translates via `args.collectionToEntityType`
 *    when walking the dependency order and scans `args.dependencyOrder` when
 *    resuming.
 *  - Errors thrown inside the iteration loop are classified by the injected
 *    `classifyError` (or the default classifier): fatal errors abort the run;
 *    non-fatal errors are recorded and iteration continues.
 */
import {
  advanceWithinCollection,
  bumpCollectionTotals,
  completeCollection,
  emptyCheckpointState,
  resumeStartCollection,
  type AdvanceDelta,
} from "./checkpoint.js";
import { createMappingContext, type MappingContext, type MappingWarning } from "./context.js";
import { classifyErrorDefault, isFatalError, ResumeCutoffNotFoundError } from "./engine-errors.js";
import { CHECKPOINT_CHUNK_SIZE } from "./import-core.constants.js";
import { isBatchMapper, type MapperDispatchEntry, type SourceDocument } from "./mapper-dispatch.js";

import type { ErrorClassifier } from "./engine-errors.js";
import type { MapperResult } from "./mapper-result.js";
import type { PersistableEntity, Persister, PersisterUpsertAction } from "./persister.types.js";
import type { ImportDataSource } from "./source.types.js";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionType,
  ImportError,
  ImportSourceFormat,
} from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the signal has been aborted. Isolated into a function so
 * TypeScript's control-flow narrowing cannot eliminate the second check
 * inside the document loop -- `AbortSignal.aborted` is mutable.
 */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Build a single-document `AdvanceDelta` for one of the four terminal outcomes. */
function delta(kind: "imported" | "updated" | "skipped" | "failed"): AdvanceDelta {
  return {
    imported: kind === "imported" ? 1 : 0,
    updated: kind === "updated" ? 1 : 0,
    skipped: kind === "skipped" ? 1 : 0,
    failed: kind === "failed" ? 1 : 0,
    total: 1,
  };
}

/**
 * Narrow a dispatch result into a {@link PersistableEntity} variant at the
 * upsert boundary.
 *
 * Invariant: the mapper dispatch table guarantees that for each collection the
 * mapper returns a payload whose shape matches the `Mapped<Entity>` type
 * bound to the corresponding `entityType` variant of `PersistableEntity`.
 * We therefore construct the variant with a single controlled cast —
 * avoiding widening the persister's input type or threading a generic
 * through the dispatch table — and the TypeScript compiler enforces the
 * shape of every consumer of the narrowed result. A runtime guard rejects
 * primitives and null payloads so misrouted dispatch entries surface as a
 * visible error rather than a silent cast.
 */
export function buildPersistableEntity(
  entityType: ImportCollectionType,
  sourceEntityId: string,
  sourceFormat: ImportSourceFormat,
  payload: unknown,
): PersistableEntity {
  if (payload === null || typeof payload !== "object") {
    throw new Error(
      `mapper for ${entityType} returned non-object payload (${typeof payload}); dispatch table may be misrouted`,
    );
  }
  return { entityType, sourceEntityId, source: sourceFormat, payload };
}

// ---------------------------------------------------------------------------
// Result constructors
// ---------------------------------------------------------------------------

function abortedResult(
  state: ImportCheckpointState,
  ctx: MappingContext,
  errors: readonly ImportError[],
): ImportRunResult {
  return { finalState: state, warnings: ctx.warnings, errors, outcome: "aborted" };
}

function completedResult(
  state: ImportCheckpointState,
  ctx: MappingContext,
  errors: readonly ImportError[],
): ImportRunResult {
  return { finalState: state, warnings: ctx.warnings, errors, outcome: "completed" };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BeforeCollectionArgs {
  readonly collection: string;
  readonly entityType: ImportCollectionType;
  readonly persister: Persister;
  readonly ctx: MappingContext;
  readonly errors: ImportError[];
  readonly state: ImportCheckpointState;
}

export interface BeforeCollectionResult {
  readonly state: ImportCheckpointState;
  readonly abort?: boolean;
}

export interface RunImportEngineArgs<TCollection extends string = string> {
  readonly source: ImportDataSource;
  readonly persister: Persister;
  readonly sourceFormat: ImportSourceFormat;
  readonly mapperDispatch: Readonly<Partial<Record<TCollection, MapperDispatchEntry>>>;
  readonly dependencyOrder: readonly TCollection[];
  readonly collectionToEntityType: (collection: string) => ImportCollectionType;
  readonly classifyError?: ErrorClassifier;
  readonly options: {
    readonly selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly onProgress: (state: ImportCheckpointState) => Promise<void>;
  readonly abortSignal?: AbortSignal;
  readonly beforeCollection?: (args: BeforeCollectionArgs) => Promise<BeforeCollectionResult>;
}

export type ImportRunOutcome = "completed" | "aborted";

export interface ImportRunResult {
  readonly finalState: ImportCheckpointState;
  readonly warnings: readonly MappingWarning[];
  readonly errors: readonly ImportError[];
  readonly outcome: ImportRunOutcome;
}

// ---------------------------------------------------------------------------
// Resume helper
// ---------------------------------------------------------------------------

/**
 * Find the index in `dependencyOrder` of the collection corresponding to a
 * resumed entity type. Resumes are stored as `ImportCollectionType`; we scan
 * the dependency order calling `collectionToEntityType` to find the match.
 */
function indexOfResumeCollection(
  state: ImportCheckpointState,
  dependencyOrder: readonly string[],
  collectionToEntityType: (collection: string) => ImportCollectionType,
): number {
  const entityType = resumeStartCollection(state);
  for (let i = 0; i < dependencyOrder.length; i += 1) {
    const collection = dependencyOrder[i];
    if (collection !== undefined && collectionToEntityType(collection) === entityType) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Generic import engine. Iterates source collections in dependency order,
 * dispatches documents through mapper functions, and persists results.
 *
 * Supports both single-document and batch mappers. Single mappers process
 * documents one at a time as the source yields them. Batch mappers accumulate
 * all documents for a collection, then process them in one call — enabling
 * cross-document analysis such as converting PK switches into fronting
 * sessions.
 */
export async function runImportEngine<TCollection extends string>(
  args: RunImportEngineArgs<TCollection>,
): Promise<ImportRunResult> {
  const { source, persister, sourceFormat, options, onProgress, dependencyOrder } = args;
  const collectionToEntityType = args.collectionToEntityType;
  const classify = args.classifyError ?? classifyErrorDefault;
  const ctx = createMappingContext({ sourceMode: source.mode });
  const errors: ImportError[] = [];

  type CheckpointStateRef = { current: ImportCheckpointState };

  const UPSERT_ACTION_TO_DELTA: Record<PersisterUpsertAction, AdvanceDelta> = {
    created: delta("imported"),
    updated: delta("updated"),
    skipped: delta("skipped"),
  };

  /**
   * Process a single mapper result (skipped/failed/mapped) through the
   * persist-and-checkpoint pipeline. Shared by both the batch and single
   * mapper paths to eliminate duplicated error-handling and upsert logic.
   *
   * Returns `true` when a fatal error aborted the collection.
   */
  async function persistMapperResult(
    result: MapperResult<unknown>,
    sourceEntityId: string,
    entityType: ImportCollectionType,
    persistedSourceIds: string[],
    stateRef: CheckpointStateRef,
  ): Promise<boolean> {
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
      const upsert = await persister.upsertEntity(
        buildPersistableEntity(entityType, sourceEntityId, sourceFormat, result.payload),
      );
      ctx.register(entityType, sourceEntityId, upsert.pluralscapeEntityId);
      persistedSourceIds.push(sourceEntityId);
      const upsertDelta = UPSERT_ACTION_TO_DELTA[upsert.action];
      stateRef.current = advanceWithinCollection(stateRef.current, {
        entityType,
        lastSourceId: sourceEntityId,
        delta: upsertDelta,
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

  /** Set of collection names the engine iterates. Computed once per run. */
  const knownDependencyOrderSet = new Set<string>(dependencyOrder);

  try {
    // Inspect the source's top-level collections before iterating. Any name
    // the engine does not know about is surfaced as a `dropped-collection`
    // warning so the final report tells the operator we did not import that
    // data. We deliberately do this before the main loop — even when resuming
    // from a checkpoint — so the warning is visible on every run.
    const sourceCollections = await source.listCollections();
    const sourceCollectionSet = new Set(sourceCollections);
    for (const name of sourceCollections) {
      if (!knownDependencyOrderSet.has(name)) {
        ctx.addWarningOnce(`dropped-collection:${name}`, {
          entityType: "unknown",
          entityId: null,
          kind: "dropped-collection",
          key: `dropped-collection:${name}`,
          message: `Collection "${name}" is not supported by the importer and was dropped`,
        });
      }
    }
    for (const name of dependencyOrder) {
      if (!sourceCollectionSet.has(name)) {
        ctx.addWarningOnce(`source-missing-collection:${name}`, {
          entityType: "unknown",
          entityId: null,
          kind: "dropped-collection",
          key: `source-missing-collection:${name}`,
          message: `Collection "${name}" is expected but was not reported by the source`,
        });
      }
    }

    const firstCollection = dependencyOrder[0];
    if (firstCollection === undefined) {
      throw new Error("Import dependency order is empty — no collections to process");
    }

    let state: ImportCheckpointState =
      args.initialCheckpoint ??
      emptyCheckpointState({
        firstEntityType: collectionToEntityType(firstCollection),
        selectedCategories: options.selectedCategories,
        avatarMode: options.avatarMode,
      });

    const startIndex = indexOfResumeCollection(state, dependencyOrder, collectionToEntityType);
    const safeStartIndex = startIndex < 0 ? 0 : startIndex;

    for (
      let collectionIndex = safeStartIndex;
      collectionIndex < dependencyOrder.length;
      collectionIndex += 1
    ) {
      const collection: TCollection | undefined = dependencyOrder[collectionIndex];
      if (collection === undefined) continue;
      if (isAborted(args.abortSignal)) {
        return abortedResult(state, ctx, errors);
      }
      const entityType = collectionToEntityType(collection);

      if (options.selectedCategories[entityType] === false) {
        // User opted out: advance the checkpoint past this collection without
        // touching the source.
        const nextCollection = dependencyOrder[collectionIndex + 1];
        const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
        state = completeCollection(state, { nextEntityType });
        await persister.flush();
        await onProgress(state);
        continue;
      }

      // Capture the resume cutoff at collection entry BEFORE any
      // beforeCollection hook can mutate `currentCollectionLastSourceId`.
      // We only honour the cutoff against the original checkpoint and stop
      // honouring it once we walk past the resumed source ID.
      const resumeCutoffSourceId =
        state.checkpoint.currentCollection === entityType
          ? state.checkpoint.currentCollectionLastSourceId
          : null;

      // beforeCollection hook: source-specific logic that runs once per
      // collection before iteration begins (e.g., SP legacy bucket
      // synthesis).
      if (args.beforeCollection) {
        const hookResult = await args.beforeCollection({
          collection,
          entityType,
          persister,
          ctx,
          errors,
          state,
        });
        state = hookResult.state;
        if (hookResult.abort) {
          return abortedResult(state, ctx, errors);
        }
      }

      // Determine mapper dispatch entry for this collection.
      const entry: MapperDispatchEntry | undefined = args.mapperDispatch[collection];
      if (!entry) {
        // No mapper registered for this collection — skip it. This can happen
        // when a source reports a collection name we put in the dependency
        // order but have not yet implemented a mapper for.
        const nextCollection = dependencyOrder[collectionIndex + 1];
        const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
        state = completeCollection(state, { nextEntityType });
        await persister.flush();
        await onProgress(state);
        continue;
      }

      // Includes created, updated, AND skipped docs — all valid for dependent
      // fetch parent enumeration.
      const persistedSourceIds: string[] = [];
      let docsSinceCheckpoint = 0;
      let collectionAborted = false;
      let pastResumeCutoff = resumeCutoffSourceId === null;

      if (isBatchMapper(entry)) {
        // ---------------------------------------------------------------
        // Batch mapper path: accumulate all documents, then map in bulk.
        // ---------------------------------------------------------------
        try {
          const accumulated: SourceDocument[] = [];

          for await (const event of source.iterate(collection)) {
            if (isAborted(args.abortSignal)) {
              return abortedResult(state, ctx, errors);
            }

            if (!pastResumeCutoff) {
              if (event.sourceId === resumeCutoffSourceId) {
                pastResumeCutoff = true;
              }
              continue;
            }

            if (event.kind === "drop") {
              const error: ImportError = {
                entityType,
                entityId: event.sourceId,
                message: event.reason,
                kind: "invalid-source-document",
                fatal: false,
              };
              errors.push(error);
              await persister.recordError(error);
              if (event.sourceId !== null) {
                state = advanceWithinCollection(state, {
                  entityType,
                  lastSourceId: event.sourceId,
                  delta: delta("failed"),
                });
              } else {
                state = bumpCollectionTotals(state, entityType, delta("failed"));
              }
              docsSinceCheckpoint += 1;
              if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
                await persister.flush();
                await onProgress(state);
                docsSinceCheckpoint = 0;
              }
              continue;
            }

            accumulated.push({ sourceId: event.sourceId, document: event.document });
          }

          // Process all accumulated documents in a single batch call.
          const batchResults = entry.mapBatch(accumulated, ctx);

          const stateRef: CheckpointStateRef = { current: state };
          for (const batchItem of batchResults) {
            if (isAborted(args.abortSignal)) {
              state = stateRef.current;
              return abortedResult(state, ctx, errors);
            }

            const fatal = await persistMapperResult(
              batchItem.result,
              batchItem.sourceEntityId,
              entityType,
              persistedSourceIds,
              stateRef,
            );
            if (fatal) {
              collectionAborted = true;
              state = stateRef.current;
              break;
            }

            docsSinceCheckpoint += 1;
            if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
              state = stateRef.current;
              await persister.flush();
              await onProgress(state);
              docsSinceCheckpoint = 0;
            }
          }
          state = stateRef.current;
        } catch (thrown) {
          // Source iteration itself threw — always fatal.
          const classified = classify(thrown, { entityType, entityId: null });
          const error: ImportError = classified.fatal
            ? classified
            : {
                entityType: classified.entityType,
                entityId: classified.entityId,
                message: classified.message,
                fatal: true,
                recoverable: true,
              };
          errors.push(error);
          await persister.recordError(error);
          return abortedResult(state, ctx, errors);
        }
      } else {
        // ---------------------------------------------------------------
        // Single mapper path: process documents one at a time.
        // ---------------------------------------------------------------
        try {
          const singleStateRef: CheckpointStateRef = { current: state };
          for await (const event of source.iterate(collection)) {
            if (!pastResumeCutoff) {
              if (event.sourceId === resumeCutoffSourceId) {
                pastResumeCutoff = true;
              }
              continue;
            }

            if (event.kind === "drop") {
              const error: ImportError = {
                entityType,
                entityId: event.sourceId,
                message: event.reason,
                kind: "invalid-source-document",
                fatal: false,
              };
              errors.push(error);
              await persister.recordError(error);
              if (event.sourceId !== null) {
                state = advanceWithinCollection(state, {
                  entityType,
                  lastSourceId: event.sourceId,
                  delta: delta("failed"),
                });
              } else {
                state = bumpCollectionTotals(state, entityType, delta("failed"));
              }
              docsSinceCheckpoint += 1;
              if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
                await persister.flush();
                await onProgress(state);
                docsSinceCheckpoint = 0;
              }
              if (isAborted(args.abortSignal)) {
                return abortedResult(state, ctx, errors);
              }
              continue;
            }

            const doc = event;
            const result = entry.map(doc.document, ctx);
            singleStateRef.current = state;

            const fatal = await persistMapperResult(
              result,
              doc.sourceId,
              entityType,
              persistedSourceIds,
              singleStateRef,
            );
            state = singleStateRef.current;
            if (fatal) {
              collectionAborted = true;
              break;
            }

            docsSinceCheckpoint += 1;
            if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
              await persister.flush();
              await onProgress(state);
              docsSinceCheckpoint = 0;
            }

            if (isAborted(args.abortSignal)) {
              return abortedResult(state, ctx, errors);
            }
          }
        } catch (thrown) {
          // Source iteration itself threw — always fatal regardless of the
          // underlying error type. Generic `Error` instances would otherwise be
          // classified as non-fatal by the default classifier, but there is no
          // way to continue iterating a source whose generator has thrown, so
          // we override `fatal` to make the abort explicit in recorded errors.
          const classified = classify(thrown, { entityType, entityId: null });
          const error: ImportError = classified.fatal
            ? classified
            : {
                entityType: classified.entityType,
                entityId: classified.entityId,
                message: classified.message,
                fatal: true,
                recoverable: true,
              };
          errors.push(error);
          await persister.recordError(error);
          return abortedResult(state, ctx, errors);
        }
      }

      // Resume cutoff sanity check: if we were resuming mid-collection and
      // never saw the checkpointed `lastSourceId` during iteration, the source
      // likely dropped that document between runs. Aborting (rather than
      // silently skipping the rest of the collection) forces the operator to
      // restart the import deliberately.
      if (resumeCutoffSourceId !== null && !pastResumeCutoff) {
        const cutoffError = classify(
          new ResumeCutoffNotFoundError(collection, resumeCutoffSourceId),
          { entityType, entityId: resumeCutoffSourceId },
        );
        errors.push(cutoffError);
        await persister.recordError(cutoffError);
        return abortedResult(state, ctx, errors);
      }

      if (collectionAborted) {
        return abortedResult(state, ctx, errors);
      }

      // Collection finished cleanly — advance state and flush+report.
      const nextCollection = dependencyOrder[collectionIndex + 1];
      const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
      state = completeCollection(state, { nextEntityType });
      await persister.flush();
      await onProgress(state);

      if (source.supplyParentIds && persistedSourceIds.length > 0) {
        source.supplyParentIds(collection, persistedSourceIds);
      }
    }

    return completedResult(state, ctx, errors);
  } finally {
    try {
      await source.close();
    } catch (closeError: unknown) {
      // Cannot rethrow — would mask the original error or success result.
      // Record as a warning so resource leaks are observable in the report.
      ctx.addWarningOnce("source-close-error", {
        entityType: "unknown",
        entityId: null,
        key: "source-close-error",
        message: `source.close() failed: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
      });
    }
  }
}
