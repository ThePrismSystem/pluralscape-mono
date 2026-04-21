# @pluralscape/import-core

Shared import orchestration engine — extracted from the Simply Plural import to serve as the foundation for all import sources ([ADR 034](../../docs/adr/034-import-core-extraction.md)).

This package defines the core abstractions that every import engine (SP, PK, future sources) builds on. It contains no source-specific logic.

---

## Key abstractions

### `Persister`

```ts
interface Persister {
  upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}
```

- `upsertEntity` MUST be idempotent keyed on `(entityType, sourceEntityId)`. Content-identical re-upserts SHOULD return `action: "skipped"` so engine progress counters report no-op work accurately.
- `upsertEntity` returns `{ action, pluralscapeEntityId }` where `action` is `"created" | "updated" | "skipped"`.
- `recordError` MUST NOT throw — error recording must always succeed.
- `flush` is called at chunk boundaries (every `CHECKPOINT_CHUNK_SIZE` documents) and at each collection boundary; implementations should commit any buffered writes before resolving.

`PersistableEntity` carries an `entityType: ImportCollectionType` discriminator, `sourceEntityId`, `source: ImportSourceFormat`, and a payload typed as `unknown`. Source-specific packages narrow the payload via their own discriminated unions.

### `ImportDataSource`

```ts
interface ImportDataSource {
  readonly mode: SourceMode; // "api" | "file" | "fake"
  iterate(collection: string): AsyncIterable<SourceEvent>;
  listCollections(): Promise<readonly string[]>;
  close(): Promise<void>;
  supplyParentIds?(parentCollection: string, sourceIds: readonly string[]): void;
}
```

Sources yield `SourceEvent`s tagged either `"doc"` (a raw document the engine validates and maps) or `"drop"` (a document the source knowingly rejected before producing it — recorded by the engine as a non-fatal `invalid-source-document` error). Transport and parse failures throw and are fatal. Iteration order must be stable across calls so the engine's resume cursor remains meaningful.

`supplyParentIds` is an optional hook the engine invokes after finishing a parent collection, passing the source IDs persisted from that collection to any dependent collection that needs them.

### Checkpoint and resume

Imports are resumable via `ImportCheckpointState`, persisted on the `import_jobs.checkpoint_state` column (JSONB). Checkpoint state is keyed by `ImportCollectionType` (e.g., `"member"`), not source-specific collection names. The engine persists progress every `CHECKPOINT_CHUNK_SIZE = 50` documents and at each collection boundary, invoking `persister.flush()` then the caller's `onProgress(state)` callback.

On resume, the engine:

1. Skips collections in `completedCollections`.
2. Finds the current collection in `dependencyOrder` via `collectionToEntityType`.
3. Advances through its iterator discarding events until it sees `currentCollectionLastSourceId`, then continues mapping from the next event.
4. If the cutoff ID is never seen (the source dropped that document between runs), the engine aborts with a fatal `ResumeCutoffNotFoundError` rather than silently skipping the remainder — operators must restart the import deliberately.

### Entity reference tracking

`import_entity_refs` (in `@pluralscape/db`) maps `(account_id, system_id, source, source_entity_type, source_entity_id)` to `pluralscape_entity_id`. This enables dedup across re-imports and cross-source entity resolution, and is how a real persister computes whether an upsert is `created`, `updated`, or `skipped`.

### Error classification

```ts
type ErrorClassifier = (thrown: unknown, ctx: ClassifyContext) => ImportError;

classifyErrorDefault(thrown, ctx): ImportError;
isFatalError(error: ImportError): boolean;
```

Callers can inject their own `ErrorClassifier` via `RunImportEngineArgs.classifyError`; otherwise the engine uses `classifyErrorDefault`:

- `ResumeCutoffNotFoundError` → `fatal: true, recoverable: true` (restart required, but checkpoint is preserved).
- `SyntaxError` (parse failure) → `fatal: true, recoverable: false`.
- Anything else → `fatal: false` (record as non-fatal `ImportError` and continue).

Errors thrown by the source's iterator are always treated as fatal — there is no way to continue iterating after the generator has thrown.

### Mapper dispatch

Each collection is wired to either a `SingleMapperEntry` (document-at-a-time) or a `BatchMapperEntry` (all documents for the collection supplied as one array, enabling cross-document analysis such as converting PK switches into fronting sessions). Mappers return a tagged `MapperResult`: `mapped | skipped | failed`.

---

## Testing helpers

The `@pluralscape/import-core/testing` subpath exports:

- `createInMemoryPersister(options?)` — returns `{ persister, snapshot }`. Stores upserts keyed by `(entityType, sourceEntityId)`, hashes payloads so content-identical re-upserts return `action: "skipped"`, and produces deterministic `pluralscapeEntityId`s (SHA-256 prefix of the key) so fixture assertions can pin IDs. Accepts `throwOn` specs to inject per-entity failures for error-path tests.
- `createFakeImportSource(data, options?)` — an in-memory `ImportDataSource` for engine tests.

```ts
import { createInMemoryPersister } from "@pluralscape/import-core/testing";

const { persister, snapshot } = createInMemoryPersister();
// ... run engine ...
const { entitiesByType, errors, flushCount } = snapshot();
entitiesByType("member"); // readonly StoredEntity[]
```

---

## Dependencies

- `@pluralscape/types` — `ImportCollectionType`, `ImportEntityType`, `ImportError`, `ImportFailureKind`, `ImportCheckpointState`, `ImportSourceFormat`, `ImportAvatarMode`, branded IDs.

---

## See also

- [ADR 034](../../docs/adr/034-import-core-extraction.md) — extraction rationale.
- `packages/import-sp` — Simply Plural import engine (sources, mappers, fixtures).
- `packages/import-pk` — PluralKit import engine.
- `apps/mobile/src/features/import-sp/persister/` — mobile-side `Persister` implementations.
- `packages/db` — `import_jobs` (with `checkpoint_state` JSONB column) and `import_entity_refs` schema.
