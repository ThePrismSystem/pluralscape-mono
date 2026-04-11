import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionTotals,
  ImportCollectionType,
} from "@pluralscape/types";

/**
 * Checkpoint state is keyed by `ImportCollectionType` (values like `"member"`),
 * not `SpCollectionName` (values like `"members"`). Callers walking
 * `DEPENDENCY_ORDER` (which is keyed by `SpCollectionName`) must translate
 * via `collectionToEntityType()` from `entity-type-map.ts` before invoking
 * these helpers.
 */

/** Schema version emitted by `emptyCheckpointState`. Bumped when the shape changes. */
const CHECKPOINT_SCHEMA_VERSION = 1;

/** Zero-valued totals used when initializing a per-collection counter. */
const ZERO_TOTALS: ImportCollectionTotals = {
  total: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
};

export interface AdvanceDelta {
  readonly imported: number;
  readonly updated: number;
  readonly skipped: number;
  readonly failed: number;
  readonly total: number;
}

/**
 * Build a fresh `ImportCheckpointState` for a new import job.
 *
 * `firstEntityType` must be an `ImportCollectionType`, not an `SpCollectionName`.
 * When deriving it from `DEPENDENCY_ORDER` (keyed by collection name), translate
 * first:
 *
 * @example
 *   emptyCheckpointState({
 *     firstEntityType: collectionToEntityType(DEPENDENCY_ORDER[0]),
 *     selectedCategories,
 *     avatarMode,
 *   });
 */
export function emptyCheckpointState(opts: {
  firstEntityType: ImportCollectionType;
  selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
  avatarMode: ImportAvatarMode;
}): ImportCheckpointState {
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    checkpoint: {
      completedCollections: [],
      currentCollection: opts.firstEntityType,
      currentCollectionLastSourceId: null,
    },
    options: {
      selectedCategories: opts.selectedCategories,
      avatarMode: opts.avatarMode,
    },
    totals: { perCollection: {} },
  };
}

export function advanceWithinCollection(
  state: ImportCheckpointState,
  args: {
    entityType: ImportCollectionType;
    lastSourceId: string;
    delta: AdvanceDelta;
  },
): ImportCheckpointState {
  const prev: ImportCollectionTotals = state.totals.perCollection[args.entityType] ?? ZERO_TOTALS;
  const updated: ImportCollectionTotals = {
    total: prev.total + args.delta.total,
    imported: prev.imported + args.delta.imported,
    updated: prev.updated + args.delta.updated,
    skipped: prev.skipped + args.delta.skipped,
    failed: prev.failed + args.delta.failed,
  };
  return {
    ...state,
    checkpoint: {
      ...state.checkpoint,
      currentCollection: args.entityType,
      currentCollectionLastSourceId: args.lastSourceId,
    },
    totals: {
      perCollection: {
        ...state.totals.perCollection,
        [args.entityType]: updated,
      },
    },
  };
}

export function completeCollection(
  state: ImportCheckpointState,
  args: { nextEntityType: ImportCollectionType },
): ImportCheckpointState {
  const completed = state.checkpoint.completedCollections.includes(
    state.checkpoint.currentCollection,
  )
    ? state.checkpoint.completedCollections
    : [...state.checkpoint.completedCollections, state.checkpoint.currentCollection];
  return {
    ...state,
    checkpoint: {
      ...state.checkpoint,
      completedCollections: completed,
      currentCollection: args.nextEntityType,
      currentCollectionLastSourceId: null,
    },
  };
}

/**
 * Bump per-collection totals without advancing `currentCollectionLastSourceId`.
 * Used by the engine for drop events carrying no `sourceId` — the resume
 * cursor must not move past a failure the source could not uniquely identify,
 * but the failure still has to count toward the collection totals shown to
 * the operator.
 */
export function bumpCollectionTotals(
  state: ImportCheckpointState,
  entityType: ImportCollectionType,
  delta: AdvanceDelta,
): ImportCheckpointState {
  const prev: ImportCollectionTotals = state.totals.perCollection[entityType] ?? ZERO_TOTALS;
  const updated: ImportCollectionTotals = {
    total: prev.total + delta.total,
    imported: prev.imported + delta.imported,
    updated: prev.updated + delta.updated,
    skipped: prev.skipped + delta.skipped,
    failed: prev.failed + delta.failed,
  };
  return {
    ...state,
    checkpoint: {
      ...state.checkpoint,
      currentCollection: entityType,
    },
    totals: {
      perCollection: {
        ...state.totals.perCollection,
        [entityType]: updated,
      },
    },
  };
}

export function resumeStartCollection(state: ImportCheckpointState): ImportCollectionType {
  return state.checkpoint.currentCollection;
}
