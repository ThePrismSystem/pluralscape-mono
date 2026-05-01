/**
 * Import engine orchestrator.
 *
 * Walks `DEPENDENCY_ORDER`, dispatches each document through the
 * `MAPPER_DISPATCH` table, persists `mapped` results via the injected
 * `Persister`, records non-fatal failures, and aborts on fatal transport or
 * parse errors with a recoverable checkpoint preserved.
 *
 * Public surface:
 *  - {@link runImport} — the orchestrator entry point.
 *  - {@link RunImportArgs}, {@link ImportRunResult} — argument and result
 *    shapes the API service uses to bridge the engine to `import_jobs`.
 *
 * Design notes:
 *  - The engine never imports the API client. It calls the injected
 *    `Persister` and `onProgress` callbacks instead.
 *  - The engine calls `synthesizeLegacyBuckets` itself when the source has no
 *    `privacyBuckets` collection so member mappers can resolve their synthetic
 *    bucket source IDs (`synthetic:public` etc.).
 *  - Checkpoint state is keyed by `ImportEntityType`, not `SpCollectionName`.
 *    The engine translates via {@link collectionToEntityType} when calling
 *    checkpoint helpers and via {@link entityTypeToCollection} when resuming.
 *  - Errors thrown inside the iteration loop are classified by
 *    {@link classifyError}: fatal errors abort the run; non-fatal errors are
 *    recorded against the failing document and iteration continues.
 */
import {
  advanceWithinCollection,
  bumpCollectionTotals,
  completeCollection,
  emptyCheckpointState,
  markRealPrivacyBucketsMapped,
} from "@pluralscape/import-core";

import { createMappingContext } from "../mappers/context.js";

import { DEPENDENCY_ORDER } from "./dependency-order.js";
import { classifyError, isFatalError, ResumeCutoffNotFoundError } from "./engine-errors.js";
import { collectionToEntityType, entityTypeToCollection } from "./entity-type-map.js";
import { MAPPER_DISPATCH } from "./mapper-dispatch.js";
import {
  buildPersistableEntity,
  CHECKPOINT_CHUNK_SIZE,
  delta,
  indexOfResumeCollection,
  isAborted,
  KNOWN_DEPENDENCY_ORDER_SET,
  makeAbortedResult,
  makeCompletedResult,
  persistSynthesizedBuckets,
} from "./orchestrator-helpers.js";

import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportCheckpointState, ImportError } from "@pluralscape/types";

export type { ImportRunOutcome, ImportRunResult } from "@pluralscape/import-core";
export { buildPersistableEntity } from "./orchestrator-helpers.js";
export type { RunImportArgs } from "./orchestrator-helpers.js";

export async function runImport(
  args: import("./orchestrator-helpers.js").RunImportArgs,
): Promise<import("@pluralscape/import-core").ImportRunResult> {
  const { source, persister, options, onProgress } = args;
  const ctx = createMappingContext({ sourceMode: source.mode });
  const errors: ImportError[] = [];

  try {
    // Inspect the source's top-level collections before iterating. Any name
    // the engine does not know about (e.g. SP's `friends` or
    // `pendingFriendRequests`) is surfaced as a `dropped-collection` warning
    // so the final report tells the operator we did not import that data.
    // We deliberately do this before the main loop — even when resuming from a
    // checkpoint — so the warning is visible on every run.
    const sourceCollections = await source.listCollections();
    const sourceCollectionSet = new Set(sourceCollections);
    for (const name of sourceCollections) {
      if (!KNOWN_DEPENDENCY_ORDER_SET.has(name)) {
        ctx.addWarningOnce(`dropped-collection:${name}`, {
          entityType: "unknown",
          entityId: null,
          kind: "dropped-collection",
          key: `dropped-collection:${name}`,
          message: `Collection "${name}" is not supported by the importer and was dropped`,
        });
      }
    }
    for (const name of DEPENDENCY_ORDER) {
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

    let state: ImportCheckpointState =
      args.initialCheckpoint ??
      emptyCheckpointState({
        firstEntityType: collectionToEntityType(DEPENDENCY_ORDER[0] ?? "users"),
        selectedCategories: options.selectedCategories,
        avatarMode: options.avatarMode,
      });

    const startIndex = indexOfResumeCollection(state);
    const safeStartIndex = startIndex < 0 ? 0 : startIndex;

    // Read the checkpointed flag rather than inferring from
    // `completedCollections` — the flag is set as soon as at least one real
    // privacy bucket is persisted within the current import job, so mid-
    // member-collection resumes do not re-synthesize legacy buckets when
    // the source had real ones.
    let privacyBucketsMapped = state.checkpoint.realPrivacyBucketsMapped ? 1 : 0;

    for (
      let collectionIndex = safeStartIndex;
      collectionIndex < DEPENDENCY_ORDER.length;
      collectionIndex += 1
    ) {
      const collection: SpCollectionName | undefined = DEPENDENCY_ORDER[collectionIndex];
      if (collection === undefined) continue;
      if (isAborted(args.abortSignal)) {
        return {
          finalState: state,
          warnings: ctx.warnings,
          errors,
          outcome: "aborted" as const,
        };
      }
      const entityType = collectionToEntityType(collection);

      if (options.selectedCategories[entityType] === false) {
        // User opted out: advance the checkpoint past this collection without
        // touching the source.
        const nextCollection = DEPENDENCY_ORDER[collectionIndex + 1];
        const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
        state = completeCollection(state, { nextEntityType });
        await persister.flush();
        await onProgress(state);
        continue;
      }

      // Capture the resume cutoff at collection entry BEFORE any bookkeeping
      // (including legacy bucket synthesis below) can mutate
      // `currentCollectionLastSourceId`. We only honour the cutoff against the
      // original checkpoint and stop honouring it once we walk past the
      // resumed source ID. This correctly handles sources whose IDs are not
      // lexicographically sortable: we walk the (stable) iteration order and
      // skip every doc up to and including the cutoff.
      const resumeCutoffSourceId =
        state.checkpoint.currentCollection === entityType
          ? state.checkpoint.currentCollectionLastSourceId
          : null;

      // Legacy bucket synthesis: when we enter members and the privacyBuckets
      // pass produced zero successfully-mapped documents, synthesize the three
      // legacy buckets so members can resolve their `synthetic:*` references.
      if (collection === "members" && privacyBucketsMapped === 0) {
        const synth = await persistSynthesizedBuckets(persister, ctx, errors);
        if (synth.aborted) {
          return makeAbortedResult(state, ctx, errors);
        }
        // Advance checkpoint totals for the synthesized buckets, mark the
        // privacy-bucket collection complete, then flush and report progress
        // before entering the member loop so a crash here is recoverable.
        if (synth.lastSourceId !== null) {
          state = advanceWithinCollection(state, {
            entityType: "privacy-bucket",
            lastSourceId: synth.lastSourceId,
            delta: synth.delta,
          });
        }
        state = completeCollection(state, { nextEntityType: entityType });
        // If we entered the member collection mid-resume, preserve the
        // original cutoff so the iteration loop below (and the
        // resume-cutoff-not-found abort path) still sees the pre-synthesis
        // checkpoint position.
        if (resumeCutoffSourceId !== null) {
          state = {
            ...state,
            checkpoint: {
              ...state.checkpoint,
              currentCollectionLastSourceId: resumeCutoffSourceId,
            },
          };
        }
        await persister.flush();
        await onProgress(state);
        // Mark as handled so a downstream resume doesn't re-trigger.
        privacyBucketsMapped = synth.delta.imported + synth.delta.updated + synth.delta.skipped;
      }

      // Includes created, updated, AND skipped docs — all valid for dependent fetch parent enumeration.
      const persistedSourceIds: string[] = [];
      let docsSinceCheckpoint = 0;
      let collectionAborted = false;
      let pastResumeCutoff = resumeCutoffSourceId === null;

      try {
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
              return {
                finalState: state,
                warnings: ctx.warnings,
                errors,
                outcome: "aborted" as const,
              };
            }
            continue;
          }

          const doc = event;
          const entry = MAPPER_DISPATCH[collection];
          const result = entry.map(doc.document, ctx);

          if (result.status === "skipped") {
            state = advanceWithinCollection(state, {
              entityType,
              lastSourceId: doc.sourceId,
              delta: delta("skipped"),
            });
          } else if (result.status === "failed") {
            const error: ImportError = {
              entityType,
              entityId: doc.sourceId,
              message: result.message,
              kind: result.kind,
              fatal: false,
            };
            errors.push(error);
            await persister.recordError(error);
            state = advanceWithinCollection(state, {
              entityType,
              lastSourceId: doc.sourceId,
              delta: delta("failed"),
            });
          } else {
            // status === "mapped"
            try {
              const upsert = await persister.upsertEntity(
                buildPersistableEntity(entityType, doc.sourceId, result.payload),
              );
              ctx.register(entityType, doc.sourceId, upsert.pluralscapeEntityId);
              persistedSourceIds.push(doc.sourceId);
              if (collection === "privacyBuckets") {
                privacyBucketsMapped += 1;
                // Persist the fact in the checkpoint so resumed runs do not
                // re-synthesize legacy buckets when the source had real ones.
                state = markRealPrivacyBucketsMapped(state);
              }
              let upsertDelta: import("@pluralscape/import-core").AdvanceDelta;
              switch (upsert.action) {
                case "created":
                  upsertDelta = delta("imported");
                  break;
                case "updated":
                  upsertDelta = delta("updated");
                  break;
                case "skipped":
                  upsertDelta = delta("skipped");
                  break;
                default: {
                  const _exhaustive: never = upsert.action;
                  throw new Error(`Unhandled upsert action: ${String(_exhaustive)}`);
                }
              }
              state = advanceWithinCollection(state, {
                entityType,
                lastSourceId: doc.sourceId,
                delta: upsertDelta,
              });
            } catch (thrown) {
              const error = classifyError(thrown, { entityType, entityId: doc.sourceId });
              errors.push(error);
              await persister.recordError(error);
              if (isFatalError(error)) {
                collectionAborted = true;
                break;
              }
              // Non-fatal persister failure: record and continue with this doc
              // marked as failed in the checkpoint.
              state = advanceWithinCollection(state, {
                entityType,
                lastSourceId: doc.sourceId,
                delta: delta("failed"),
              });
            }
          }

          docsSinceCheckpoint += 1;
          if (docsSinceCheckpoint >= CHECKPOINT_CHUNK_SIZE) {
            await persister.flush();
            await onProgress(state);
            docsSinceCheckpoint = 0;
          }

          if (isAborted(args.abortSignal)) {
            return {
              finalState: state,
              warnings: ctx.warnings,
              errors,
              outcome: "aborted" as const,
            };
          }
        }
      } catch (thrown) {
        // Source iteration itself threw — this is always fatal regardless of
        // the underlying error type. Generic `Error` instances would otherwise
        // be classified as non-fatal by `classifyError`, but there is no way
        // to continue iterating a source whose generator has thrown, so we
        // override `fatal` to make the abort explicit in recorded errors.
        const classified = classifyError(thrown, { entityType, entityId: null });
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
        return makeAbortedResult(state, ctx, errors);
      }

      // Resume cutoff sanity check: if we were resuming mid-collection and
      // never saw the checkpointed `lastSourceId` during iteration, the source
      // likely dropped that document between runs. Aborting (rather than
      // silently skipping the rest of the collection) forces the operator to
      // restart the import deliberately.
      if (resumeCutoffSourceId !== null && !pastResumeCutoff) {
        const cutoffError = classifyError(
          new ResumeCutoffNotFoundError(collection, resumeCutoffSourceId),
          { entityType, entityId: resumeCutoffSourceId },
        );
        errors.push(cutoffError);
        await persister.recordError(cutoffError);
        return makeAbortedResult(state, ctx, errors);
      }

      if (collectionAborted) {
        return makeAbortedResult(state, ctx, errors);
      }

      // Collection finished cleanly — advance state and flush+report.
      const nextCollection = DEPENDENCY_ORDER[collectionIndex + 1];
      const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
      state = completeCollection(state, { nextEntityType });
      await persister.flush();
      await onProgress(state);

      if (source.supplyParentIds && persistedSourceIds.length > 0) {
        source.supplyParentIds(collection, persistedSourceIds);
      }
    }

    return makeCompletedResult(state, ctx, errors);
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

export { collectionToEntityType, entityTypeToCollection };
export { emptyCheckpointState } from "@pluralscape/import-core";
