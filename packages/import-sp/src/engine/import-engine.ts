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
import { CHECKPOINT_CHUNK_SIZE } from "../import-sp.constants.js";
import { synthesizeLegacyBuckets, type MappedPrivacyBucket } from "../mappers/bucket.mapper.js";
import {
  createMappingContext,
  type MappingContext,
  type MappingWarning,
} from "../mappers/context.js";

import {
  advanceWithinCollection,
  completeCollection,
  emptyCheckpointState,
  resumeStartCollection,
  type AdvanceDelta,
} from "./checkpoint.js";
import { DEPENDENCY_ORDER } from "./dependency-order.js";
import { classifyError, isFatalError, ResumeCutoffNotFoundError } from "./engine-errors.js";
import { collectionToEntityType, entityTypeToCollection } from "./entity-type-map.js";
import { MAPPER_DISPATCH } from "./mapper-dispatch.js";

import type { PersistableEntity, Persister } from "../persistence/persister.types.js";
import type { ImportSource } from "../sources/source.types.js";
import type { SpCollectionName } from "../sources/sp-collections.js";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionType,
  ImportError,
} from "@pluralscape/types";

/**
 * Build a single-document `AdvanceDelta` for one of the four terminal outcomes.
 * Collapses the four previous ONE_* constants into one helper — the distinction
 * between "mapper skipped" and "persister skipped" was never load-bearing at
 * the call sites, so both just map to `delta("skipped")`.
 */
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
 * Invariant: `MAPPER_DISPATCH` guarantees that for each collection, the
 * mapper returns a payload whose shape matches the `Mapped<Entity>` type
 * bound to the corresponding `entityType` variant of `PersistableEntity`. We
 * therefore construct the variant with a single controlled cast — avoiding
 * widening the persister's input type or threading a generic through the
 * dispatch table — and the TypeScript compiler enforces the shape of every
 * consumer of the narrowed result.
 */
function buildPersistableEntity(
  entityType: ImportCollectionType,
  sourceEntityId: string,
  payload: unknown,
): PersistableEntity {
  return {
    entityType,
    sourceEntityId,
    source: "simply-plural",
    payload,
  } as PersistableEntity;
}

export interface RunImportArgs {
  readonly source: ImportSource;
  readonly persister: Persister;
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly options: {
    readonly selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly onProgress: (state: ImportCheckpointState) => Promise<void>;
}

export type ImportRunOutcome = "completed" | "aborted";

export interface ImportRunResult {
  readonly finalState: ImportCheckpointState;
  readonly warnings: readonly MappingWarning[];
  readonly errors: readonly ImportError[];
  readonly outcome: ImportRunOutcome;
}

/**
 * Find the index in `DEPENDENCY_ORDER` of the collection corresponding to a
 * resumed entity type. Resumes are stored as `ImportEntityType`; we walk back
 * to the collection name to know where in the iteration order to start.
 */
function indexOfResumeCollection(state: ImportCheckpointState): number {
  const entityType = resumeStartCollection(state);
  // `entityTypeToCollection` throws when the entity type has no SP collection;
  // a freshly-built checkpoint always points at a valid SP collection so this
  // is safe in practice. Tests around malformed checkpoints would surface here.
  const collection = entityTypeToCollection(entityType);
  return DEPENDENCY_ORDER.indexOf(collection);
}

/**
 * Synthesize the three legacy privacy buckets, persist them, and register
 * each in the translation table so member mappers can resolve their
 * `synthetic:*` references. Called only when the source has no
 * `privacyBuckets` collection.
 */
async function persistSynthesizedBuckets(
  persister: Persister,
  ctx: MappingContext,
  errors: ImportError[],
): Promise<{ persisted: number; aborted: boolean; lastSourceId: string | null }> {
  const synthesized = synthesizeLegacyBuckets({ existingBucketNames: [] });
  let persisted = 0;
  let lastSourceId: string | null = null;
  for (const bucket of synthesized) {
    const payload: MappedPrivacyBucket = {
      name: bucket.name,
      description: bucket.description,
      color: null,
      icon: null,
    };
    try {
      const result = await persister.upsertEntity({
        entityType: "privacy-bucket",
        sourceEntityId: bucket.syntheticSourceId,
        source: "simply-plural",
        payload,
      });
      ctx.register("privacy-bucket", bucket.syntheticSourceId, result.pluralscapeEntityId);
      persisted += 1;
      lastSourceId = bucket.syntheticSourceId;
    } catch (thrown) {
      const error = classifyError(thrown, {
        entityType: "privacy-bucket",
        entityId: bucket.syntheticSourceId,
      });
      errors.push(error);
      await persister.recordError(error);
      if (isFatalError(error)) {
        return { persisted, aborted: true, lastSourceId };
      }
    }
  }
  return { persisted, aborted: false, lastSourceId };
}

export async function runImport(args: RunImportArgs): Promise<ImportRunResult> {
  const { source, persister, options, onProgress } = args;
  const ctx = createMappingContext({ sourceMode: source.mode });
  const errors: ImportError[] = [];

  let state: ImportCheckpointState =
    args.initialCheckpoint ??
    emptyCheckpointState({
      firstEntityType: collectionToEntityType(DEPENDENCY_ORDER[0] ?? "users"),
      selectedCategories: options.selectedCategories,
      avatarMode: options.avatarMode,
    });

  const startIndex = indexOfResumeCollection(state);
  const safeStartIndex = startIndex < 0 ? 0 : startIndex;

  // Track how many privacyBuckets documents were successfully mapped and
  // registered during the privacyBuckets pass. Used at member-collection entry
  // to decide whether to synthesize the three legacy buckets. Counting only
  // mapped (not yielded) docs avoids the bug where every bucket fails Zod
  // validation yet the count stays > 0, silently leaving members with
  // unresolved synthetic bucket references.
  //
  // When resuming past members, assume legacy synthesis (if any) already ran.
  // When resuming into members directly we cannot know whether the previous
  // run already synthesized the legacy buckets. The persister's idempotency
  // guarantees re-synthesis is safe, so we conservatively re-run.
  let privacyBucketsMapped = state.checkpoint.completedCollections.includes("member") ? 1 : 0;

  for (
    let collectionIndex = safeStartIndex;
    collectionIndex < DEPENDENCY_ORDER.length;
    collectionIndex += 1
  ) {
    const collection: SpCollectionName | undefined = DEPENDENCY_ORDER[collectionIndex];
    if (collection === undefined) continue;
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

    // Legacy bucket synthesis: when we enter members and the privacyBuckets
    // pass produced zero successfully-mapped documents, synthesize the three
    // legacy buckets so members can resolve their `synthetic:*` references.
    if (collection === "members" && privacyBucketsMapped === 0) {
      const synth = await persistSynthesizedBuckets(persister, ctx, errors);
      if (synth.aborted) {
        return {
          finalState: state,
          warnings: ctx.warnings,
          errors,
          outcome: "aborted",
        };
      }
      // Mark as handled so a downstream resume doesn't re-trigger.
      privacyBucketsMapped = synth.persisted;
    }

    let docsSinceCheckpoint = 0;
    let collectionAborted = false;
    // Capture the resume cutoff at collection entry. We only honour the
    // cutoff against the original checkpoint (`resumeCutoffSourceId`) and
    // stop honouring it once we walk past the resumed source ID. This
    // correctly handles sources whose IDs are not lexicographically
    // sortable: we walk the (stable) iteration order and skip every doc up
    // to and including the cutoff.
    const resumeCutoffSourceId =
      state.checkpoint.currentCollection === entityType
        ? state.checkpoint.currentCollectionLastSourceId
        : null;
    let pastResumeCutoff = resumeCutoffSourceId === null;

    try {
      for await (const doc of source.iterate(collection)) {
        if (!pastResumeCutoff) {
          if (doc.sourceId === resumeCutoffSourceId) {
            pastResumeCutoff = true;
          }
          continue;
        }

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
            if (collection === "privacyBuckets") privacyBucketsMapped += 1;
            const upsertDelta =
              upsert.action === "created"
                ? delta("imported")
                : upsert.action === "updated"
                  ? delta("updated")
                  : delta("skipped");
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
      return {
        finalState: state,
        warnings: ctx.warnings,
        errors,
        outcome: "aborted",
      };
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
      return {
        finalState: state,
        warnings: ctx.warnings,
        errors,
        outcome: "aborted",
      };
    }

    if (collectionAborted) {
      return {
        finalState: state,
        warnings: ctx.warnings,
        errors,
        outcome: "aborted",
      };
    }

    // Collection finished cleanly — advance state and flush+report.
    const nextCollection = DEPENDENCY_ORDER[collectionIndex + 1];
    const nextEntityType = nextCollection ? collectionToEntityType(nextCollection) : entityType;
    state = completeCollection(state, { nextEntityType });
    await persister.flush();
    await onProgress(state);
  }

  return {
    finalState: state,
    warnings: ctx.warnings,
    errors,
    outcome: "completed",
  };
}

// Re-export the entity type map helpers for callers that compose this engine.
export { collectionToEntityType, entityTypeToCollection };
