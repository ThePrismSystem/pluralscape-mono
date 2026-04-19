export type { SourceMode, SourceEvent, ImportDataSource } from "./source.types.js";
export type { MapperResult } from "./mapper-result.js";
export { mapped, skipped, failed } from "./mapper-result.js";
export type { MappingWarning, IdTranslationEntry, MappingContext } from "./context.js";
export { createMappingContext } from "./context.js";
export type {
  PersistableEntity,
  PersisterUpsertAction,
  PersisterUpsertResult,
  Persister,
} from "./persister.types.js";
export {
  CHECKPOINT_CHUNK_SIZE,
  MAX_IMPORT_FILE_BYTES,
  MAX_WARNING_BUFFER_SIZE,
} from "./import-core.constants.js";
export { toRecord, summarizeMissingRefs, parseHexColor } from "./helpers.js";

// Checkpoint
export type { AdvanceDelta } from "./checkpoint.js";
export {
  emptyCheckpointState,
  advanceWithinCollection,
  completeCollection,
  bumpCollectionTotals,
  resumeStartCollection,
  markRealPrivacyBucketsMapped,
} from "./checkpoint.js";

// Errors
export { ResumeCutoffNotFoundError, classifyErrorDefault, isFatalError } from "./engine-errors.js";
export type { ErrorClassifier, ClassifyContext } from "./engine-errors.js";

// Mapper dispatch
export type {
  SingleMapperEntry,
  BatchMapperEntry,
  MapperDispatchEntry,
  SourceDocument,
  BatchMapperOutput,
} from "./mapper-dispatch.js";
export { isBatchMapper } from "./mapper-dispatch.js";

// Engine
export type {
  RunImportEngineArgs,
  ImportRunResult,
  ImportRunOutcome,
  BeforeCollectionArgs,
  BeforeCollectionResult,
} from "./import-engine.js";
export { runImportEngine, buildPersistableEntity } from "./import-engine.js";
