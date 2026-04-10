/**
 * @pluralscape/import-sp — Simply Plural import engine.
 *
 * Public surface:
 *
 * - `runImport` — the orchestrator that walks the dependency order and
 *   delegates persistence to a caller-supplied {@link Persister}.
 * - Source factories (`createApiImportSource`, `createFileImportSource`,
 *   `createFakeImportSource`) and the `ImportSource` boundary type.
 * - Persistence boundary types (`Persister`, `PersistableEntity`,
 *   `PersisterUpsertResult`, `AvatarFetcher`, `AvatarFetchResult`).
 * - Engine helpers (`createMappingContext`, `DEPENDENCY_ORDER`,
 *   `collectionToEntityType`, `entityTypeToCollection`).
 * - Error classification (`ApiSourceTokenRejectedError`,
 *   `ApiSourceTransientError`, `classifyError`, `isFatalError`).
 *
 * Per-mapper modules are intentionally NOT re-exported. Mappers are an
 * implementation detail of the engine; the engine's caller only sees the
 * results via the persister boundary.
 */
export {
  classifyError,
  collectionToEntityType,
  DEPENDENCY_ORDER,
  entityTypeToCollection,
  isFatalError,
  ResumeCutoffNotFoundError,
  runImport,
} from "./engine/index.js";
export type { ImportRunOutcome, ImportRunResult, RunImportArgs } from "./engine/index.js";
export { createMappingContext } from "./mappers/context.js";
export type { IdTranslationEntry, MappingContext, MappingWarning } from "./mappers/context.js";
export type { AvatarFetcher, AvatarFetchResult } from "./persistence/index.js";
export type { PersistableEntity, Persister, PersisterUpsertResult } from "./persistence/index.js";
export {
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
  createApiImportSource,
  createFakeImportSource,
  createFileImportSource,
  FileSourceParseError,
  isSpCollectionName,
  SP_COLLECTION_NAMES,
} from "./sources/index.js";
export type {
  FakeSourceData,
  FileImportSourceArgs,
  ImportSource,
  SourceDocument,
  SourceMode,
  SpCollectionName,
} from "./sources/index.js";
