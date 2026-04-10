# @pluralscape/import-sp

Simply Plural import engine — pure data layer.

Parses Simply Plural JSON exports or SP REST API responses, validates each
document with Zod, maps every collection to Pluralscape entities, and drives a
resumable, checkpoint-based import via a pluggable `Persister`.

This package is **mobile-compatible** — no Node streams, no `fs`, no React.
The mobile glue (Expo SecureStore for tokens, file picker for exports, encrypted
SQLite persister) lives in `apps/mobile/src/features/import-sp/` and is wired in
Plan 3.

---

## Public surface

### `runImport(args: RunImportArgs): Promise<ImportRunResult>`

Orchestrates a full or resumed import. Walks `DEPENDENCY_ORDER`, dispatches each
document through the mapper table, persists mapped results via the injected
`Persister`, and calls `onProgress` at every checkpoint boundary.

```ts
import { runImport, createFileImportSource, createApiImportSource } from "@pluralscape/import-sp";

const result = await runImport({
  source: createFileImportSource({ fileUri: "file:///path/to/export.json" }),
  persister: myPersister,
  options: { selectedCategories: {}, avatarMode: "skip" },
  onProgress: async (state) => {
    /* persist checkpoint */
  },
});
// result.outcome: "completed" | "aborted"
// result.errors: ImportError[]
// result.warnings: MappingWarning[]
// result.finalState: ImportCheckpointState  ← pass as initialCheckpoint to resume
```

### Source factories

| Factory                        | Use case                                            |
| ------------------------------ | --------------------------------------------------- |
| `createFileImportSource(args)` | SP JSON export file (streaming Clarinet SAX parser) |
| `createApiImportSource(args)`  | Live SP REST API (paginated, with retry/backoff)    |
| `createFakeImportSource(data)` | In-memory data for tests                            |

All factories return an `ImportSource` implementing `iterate(collection)`,
`listCollections()`, and `close()`.

### Persister contract

```ts
interface Persister {
  upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}
```

- `upsertEntity` must be idempotent keyed on `(entityType, sourceEntityId)`.
  Return `action: "skipped"` for content-identical re-upserts.
- `recordError` must never throw.
- `flush` is called at chunk boundaries (`CHECKPOINT_CHUNK_SIZE = 50` docs).

`PersistableEntity` is a discriminated union — narrow on `entityType` to access
the strongly-typed `payload` without casts.

### Entity type helpers

```ts
collectionToEntityType(collection: SpCollectionName): ImportCollectionType
entityTypeToCollection(entityType: ImportCollectionType): SpCollectionName
DEPENDENCY_ORDER: SpCollectionName[]   // canonical import order
```

### Error classification

```ts
classifyError(thrown: unknown, ctx: ClassifyContext): ImportError
isFatalError(error: ImportError): boolean
```

Error classes thrown by the API source:

- `ApiSourceTokenRejectedError` — HTTP 401, fatal + recoverable (user re-enters token)
- `ApiSourceTransientError` — 429/5xx exhausted retries, fatal + recoverable
- `ApiSourcePermanentError` — non-array body / missing `_id`, fatal + non-recoverable
- `FileSourceParseError` — unparseable JSON export, fatal + non-recoverable
- `ResumeCutoffNotFoundError` — checkpointed source ID disappeared between runs

---

## Dedup policy

Every entity is upserted by `(source: "simply-plural", sourceEntityId)`. Running
the import twice produces identical results — the persister decides `created` /
`updated` / `skipped` and the engine accumulates the counts in the checkpoint.

---

## Fail-closed behavior

- Unknown SP fields are surfaced as `dropped-collection` or `unknown-field`
  warnings but never block the import.
- An empty or missing `privacyBuckets` collection triggers automatic synthesis
  of three legacy buckets (`Public`, `Trusted`, `Private`) so member privacy
  references always resolve.
- `friends` and `pendingFriendRequests` collections are intentionally unsupported
  — they appear in the source as `dropped-collection` warnings.

---

## Error classification

| Class                         | Fatal | Recoverable | Meaning                                              |
| ----------------------------- | ----- | ----------- | ---------------------------------------------------- |
| Validation failure            | No    | —           | Per-document Zod error; engine records and continues |
| FK miss                       | No    | —           | Referenced entity not yet imported; document skipped |
| `ApiSourceTokenRejectedError` | Yes   | Yes         | Re-enter token and resume from checkpoint            |
| `ApiSourceTransientError`     | Yes   | Yes         | Retry after backoff clears                           |
| `ApiSourcePermanentError`     | Yes   | No          | SP API shape mismatch; restart required              |
| `FileSourceParseError`        | Yes   | No          | Corrupt export file; restart required                |
| `ResumeCutoffNotFoundError`   | Yes   | Yes         | Source changed between runs; restart recommended     |

---

## See also

- `docs/adr/` — architecture decisions for the import engine design
- `.beans/` — work tracker (prefix `ps-nrg`)
- `packages/types` — `ImportCollectionType`, `ImportError`, `ImportCheckpointState`
- `packages/db` — `import_jobs`, `import_entity_refs` schema
