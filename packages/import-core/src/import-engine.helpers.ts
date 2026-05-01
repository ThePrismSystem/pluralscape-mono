/**
 * Pure helper utilities used by the import engine orchestrator.
 *
 * Extracted from `import-engine.ts` to keep the orchestrator file under the
 * area LOC ceiling. Nothing in this module is part of the public package
 * surface — consumers should import from `import-engine.js`, which
 * re-exports `buildPersistableEntity` for downstream callers.
 */
import { resumeStartCollection, type AdvanceDelta } from "./checkpoint.js";

import type { PersistableEntity } from "./persister.types.js";
import type {
  ImportCheckpointState,
  ImportCollectionType,
  ImportSourceFormat,
} from "@pluralscape/types";

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

/**
 * Find the index in `dependencyOrder` of the collection corresponding to a
 * resumed entity type. Resumes are stored as `ImportCollectionType`; we scan
 * the dependency order calling `collectionToEntityType` to find the match.
 */
export function indexOfResumeCollection(
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
