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
export { DEPENDENCY_ORDER } from "./engine/dependency-order.js";
export { classifyError, isFatalError, ResumeCutoffNotFoundError } from "./engine/engine-errors.js";
export { collectionToEntityType, entityTypeToCollection } from "./engine/entity-type-map.js";
export { runImport } from "./engine/import-engine.js";
export type { ImportRunOutcome, ImportRunResult, RunImportArgs } from "./engine/import-engine.js";
export { createMappingContext } from "./mappers/context.js";
export type { IdTranslationEntry, MappingContext, MappingWarning } from "./mappers/context.js";
export type { AvatarFetcher, AvatarFetchResult } from "./persistence/avatar-fetcher.types.js";
export type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "./persistence/persister.types.js";
export {
  ApiSourceTokenRejectedError,
  ApiSourceTransientError,
  createApiImportSource,
} from "./sources/api-source.js";
export { createFakeImportSource } from "./sources/fake-source.js";
export type { FakeSourceData } from "./sources/fake-source.js";
export { createFileImportSource } from "./sources/file-source.js";
export type { ImportSource, SourceDocument, SourceMode } from "./sources/source.types.js";
export { SP_COLLECTION_NAMES, isSpCollectionName } from "./sources/sp-collections.js";
export type { SpCollectionName } from "./sources/sp-collections.js";
