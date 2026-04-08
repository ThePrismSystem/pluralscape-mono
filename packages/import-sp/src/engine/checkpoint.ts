import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionTotals,
  ImportEntityType,
} from "@pluralscape/types";

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

export function emptyCheckpointState(opts: {
  firstEntityType: ImportEntityType;
  selectedCategories: Record<string, boolean>;
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
    entityType: ImportEntityType;
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
  args: { nextEntityType: ImportEntityType },
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

export function shouldSkipBefore(
  state: ImportCheckpointState,
  entityType: ImportEntityType,
  sourceId: string,
): boolean {
  if (state.checkpoint.currentCollection !== entityType) return false;
  const last = state.checkpoint.currentCollectionLastSourceId;
  if (last === null) return false;
  return sourceId <= last;
}

export function resumeStartCollection(state: ImportCheckpointState): ImportEntityType {
  return state.checkpoint.currentCollection;
}
