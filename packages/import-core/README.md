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

- `upsertEntity` must be idempotent keyed on `(entityType, sourceEntityId)`. Return `action: "skipped"` for content-identical re-upserts.
- `recordError` must never throw.
- `flush` is called at chunk boundaries for checkpoint persistence.

`PersistableEntity` is a discriminated union — narrow on `entityType` to access the strongly-typed `payload` without casts.

### `ImportSource`

```ts
interface ImportDataSource {
  listCollections(): Promise<string[]>;
  iterate(collection: string): AsyncIterable<unknown>;
  close(): Promise<void>;
  supplyParentIds?(): Promise<Map<string, string[]>>;
}
```

Each import engine provides its own source factories (file, API, fake).

### Checkpoint and resume

Imports are resumable via `ImportCheckpointState`. The engine records progress at chunk boundaries (`CHECKPOINT_CHUNK_SIZE = 50` documents). On resume, collections already completed are skipped and the in-progress collection resumes from the last checkpointed source entity ID.

### Entity reference tracking

`import_entity_refs` (in `@pluralscape/db`) maps `(source, sourceEntityType, sourceEntityId)` to `pluralscapeEntityId`. This enables dedup across re-imports and cross-source entity resolution.

### Error classification

```ts
classifyError(thrown: unknown, ctx: ClassifyContext): ImportError
isFatalError(error: ImportError): boolean
```

Errors are classified as fatal (abort import) or non-fatal (record and continue). Fatal errors may be recoverable (resume from checkpoint after user action) or non-recoverable (restart required).

---

## Testing

`InMemoryPersister` is provided for unit and integration tests. It accumulates entities in memory and exposes a snapshot for assertions:

```ts
import { InMemoryPersister } from "@pluralscape/import-core/testing";

const persister = new InMemoryPersister();
// ... run import ...
const snapshot = persister.snapshot();
snapshot.entitiesByType("member"); // PersistableEntity[]
```

---

## Dependencies

- `@pluralscape/types` — `ImportCollectionType`, `ImportError`, `ImportCheckpointState`, branded IDs

---

## See also

- [ADR 034](../../docs/adr/034-import-core-extraction.md) — extraction rationale
- `packages/import-sp` — Simply Plural import engine
- `packages/import-pk` — PluralKit import engine
- `packages/db` — `import_jobs`, `import_entity_refs` schema
