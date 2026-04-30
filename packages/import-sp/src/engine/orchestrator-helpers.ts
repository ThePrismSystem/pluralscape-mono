/**
 * Internal helpers for the import engine orchestrator.
 *
 * Extracted from `import-engine.ts` to keep the orchestrator file under the
 * LOC ceiling. Nothing in this module is part of the public API — consumers
 * should import from `engine/import-engine.js`.
 */
import {
  advanceWithinCollection,
  resumeStartCollection,
  type AdvanceDelta,
  type ImportRunResult,
} from "@pluralscape/import-core";

import { CHECKPOINT_CHUNK_SIZE } from "../import-sp.constants.js";
import { synthesizeLegacyBuckets, type MappedPrivacyBucket } from "../mappers/bucket.mapper.js";
import { type MappingContext } from "../mappers/context.js";

import { DEPENDENCY_ORDER } from "./dependency-order.js";
import { classifyError, isFatalError } from "./engine-errors.js";
import { entityTypeToCollection } from "./entity-type-map.js";

import type { PersistableEntity, Persister } from "../persistence/persister.types.js";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionType,
  ImportError,
} from "@pluralscape/types";

export { CHECKPOINT_CHUNK_SIZE };

/**
 * Check whether the signal has been aborted. Isolated into a function so
 * TypeScript's control-flow narrowing cannot eliminate the second check
 * inside the document loop -- `AbortSignal.aborted` is mutable.
 */
export function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Build a single-document `AdvanceDelta` for one of the four terminal outcomes. */
export function delta(kind: "imported" | "updated" | "skipped" | "failed"): AdvanceDelta {
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
  payload: unknown,
): PersistableEntity {
  if (payload === null || typeof payload !== "object") {
    throw new Error(
      `mapper for ${entityType} returned non-object payload (${typeof payload}); dispatch table may be misrouted`,
    );
  }
  return {
    entityType,
    sourceEntityId,
    source: "simply-plural",
    payload,
  } as PersistableEntity;
}

export function makeAbortedResult(
  state: ImportCheckpointState,
  ctx: MappingContext,
  errors: readonly ImportError[],
): ImportRunResult {
  return { finalState: state, warnings: ctx.warnings, errors, outcome: "aborted" };
}

export function makeCompletedResult(
  state: ImportCheckpointState,
  ctx: MappingContext,
  errors: readonly ImportError[],
): ImportRunResult {
  return { finalState: state, warnings: ctx.warnings, errors, outcome: "completed" };
}

export interface RunImportArgs {
  readonly source: import("../sources/source.types.js").ImportDataSource;
  readonly persister: Persister;
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly options: {
    readonly selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly onProgress: (state: ImportCheckpointState) => Promise<void>;
  readonly abortSignal?: AbortSignal;
}

// Re-export run-outcome types so SP consumers import from one package.
export type { ImportRunOutcome, ImportRunResult } from "@pluralscape/import-core";

/**
 * Find the index in `DEPENDENCY_ORDER` of the collection corresponding to a
 * resumed entity type. Resumes are stored as `ImportEntityType`; we walk back
 * to the collection name to know where in the iteration order to start.
 */
export function indexOfResumeCollection(state: ImportCheckpointState): number {
  const entityType = resumeStartCollection(state);
  const collection = entityTypeToCollection(entityType);
  return DEPENDENCY_ORDER.indexOf(collection);
}

/**
 * Synthesize the three legacy privacy buckets, persist them, and register
 * each in the translation table so member mappers can resolve their
 * `synthetic:*` references. Called only when the source has no
 * `privacyBuckets` collection.
 *
 * Returns the accumulated {@link AdvanceDelta} across all three buckets so
 * the caller can thread it through {@link advanceWithinCollection} and then
 * call {@link completeCollection} before entering the member loop.
 */
export async function persistSynthesizedBuckets(
  persister: Persister,
  ctx: MappingContext,
  errors: ImportError[],
): Promise<{ delta: AdvanceDelta; aborted: boolean; lastSourceId: string | null }> {
  const synthesized = synthesizeLegacyBuckets();
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let lastSourceId: string | null = null;
  for (const bucket of synthesized) {
    const payload: MappedPrivacyBucket = {
      encrypted: {
        name: bucket.name,
        description: bucket.description,
      },
    };
    try {
      const result = await persister.upsertEntity({
        entityType: "privacy-bucket",
        sourceEntityId: bucket.syntheticSourceId,
        source: "simply-plural",
        payload,
      });
      ctx.register("privacy-bucket", bucket.syntheticSourceId, result.pluralscapeEntityId);
      if (result.action === "created") importedCount += 1;
      else if (result.action === "updated") updatedCount += 1;
      else skippedCount += 1;
      lastSourceId = bucket.syntheticSourceId;
    } catch (thrown) {
      const error = classifyError(thrown, {
        entityType: "privacy-bucket",
        entityId: bucket.syntheticSourceId,
      });
      errors.push(error);
      await persister.recordError(error);
      failedCount += 1;
      if (isFatalError(error)) {
        return { delta: buildDelta(), aborted: true, lastSourceId };
      }
    }
  }
  return { delta: buildDelta(), aborted: false, lastSourceId };

  function buildDelta(): AdvanceDelta {
    return {
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
      total: importedCount + updatedCount + skippedCount + failedCount,
    };
  }
}

/** Set of SP collection names the engine iterates. Computed once per run. */
export const KNOWN_DEPENDENCY_ORDER_SET = new Set<string>(DEPENDENCY_ORDER);

// Re-export so the orchestrator does not need a direct dependency on the
// advanceWithinCollection function just for the inline aborted-result paths.
export { advanceWithinCollection };
