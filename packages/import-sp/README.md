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

All factories return an `ImportDataSource` implementing `iterate(collection)`,
`listCollections()`, `close()`, and optionally `supplyParentIds()`.

---

## Collection coverage

The SP import processes 15 SP collections. Source availability varies:

| SP Collection       | Pluralscape Entity | API Import | File Import | Notes                                   |
| ------------------- | ------------------ | ---------- | ----------- | --------------------------------------- |
| `users`             | system-profile     | Yes        | Yes         | Cherry-picked into system profile       |
| `private`           | system-settings    | No         | Yes         | SP requires JWT auth; API keys rejected |
| `privacyBuckets`    | privacy-bucket     | Yes        | Yes         |                                         |
| `customFields`      | field-definition   | Yes        | Yes         |                                         |
| `frontStatuses`     | custom-front       | Yes        | Yes         | Called `customFronts` in SP API URL     |
| `members`           | member             | Yes        | Yes         |                                         |
| `groups`            | group              | Yes        | Yes         |                                         |
| `frontHistory`      | fronting-session   | Yes        | Yes         |                                         |
| `comments`          | fronting-comment   | No         | Yes         | SP only exposes per-document endpoint   |
| `notes`             | journal-entry      | Yes        | Yes         | Multi-pass: fetched per-member          |
| `polls`             | poll               | Yes        | Yes         |                                         |
| `channelCategories` | channel-category   | Yes        | Yes         |                                         |
| `channels`          | channel            | Yes        | Yes         |                                         |
| `chatMessages`      | chat-message       | No         | Yes         | SP only exposes per-channel endpoint    |
| `boardMessages`     | board-message      | No         | Yes         | SP only exposes per-member endpoint     |

### Why some collections are file-only

The SP REST API exposes these collections only through per-parent endpoints:

- **comments** — `GET /v1/comments/:type/:id` requires a document type and ID
- **chatMessages** — `GET /v1/chat/messages/:channelId` requires a channel ID (paginated)
- **boardMessages** — `GET /v1/board/member/:memberId` requires a member ID

Without a bulk list endpoint, importing them requires enumerating every possible
parent — not feasible for comments (which span multiple document types) or practical
without significant request overhead for chat/board messages.

**notes** (journal entries) are the exception: they follow the same per-parent
pattern (`GET /v1/notes/:system/:member`) but are essential enough to warrant a
multi-pass fetch. The engine fetches all members first, then iterates each
member's notes endpoint.

**private** (system settings) uses JWT-only auth middleware
(`isUserAppJwtAuthenticated`) in the SP API, so API key authentication is
rejected with 401.

### User guidance

For a **complete import**, use the JSON file export from Simply Plural. API import
covers all essential data including member notes (journal entries) but omits fronting
comments, chat messages, and board messages.

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
