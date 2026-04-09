# Simply Plural import — design

- **Bean**: ps-nrg4 (Simply Plural import)
- **Parent milestone**: M9 Data Import Functionality (ps-h2gl)
- **Date**: 2026-04-08
- **Status**: approved, ready for implementation plan
- **Related beans**:
  - ps-9uqg — Simply Plural import wizard UI (deferred to M11 UI/UX Buildout)
  - ps-20rq — Pluralscape reminders feature (closes a parity gap exposed by this import)

## Overview

Pluralscape needs to import a user's full Simply Plural data so users coming from SP can migrate without losing history. This document specifies the data layer for that import: the engine that parses SP data, maps it to Pluralscape entities, encrypts it, persists it locally, and reports progress through the existing import-job tracking infrastructure.

The import supports two input modes:

1. **Simply Plural API token** — the client calls SP's API directly with the user's bearer token, paginating through every user-content collection.
2. **Simply Plural JSON export** — the client parses an SP-emailed export file (optionally accompanied by an avatar ZIP).

Both modes share the downstream pipeline once data is in memory on the client.

## Constraints

- **Zero-knowledge server.** Every Pluralscape entity table stores `encryptedData` blobs encrypted with per-system bucket keys. The server cannot read or write user-content entities. All parsing, mapping, encryption, and persistence must run on the client. The Pluralscape server's role is limited to operational metadata (job status, progress, error log) and an opaque source-ref dedup table.
- **Offline-first.** Local SQLite is the source of truth for entity data; the existing CRDT sync layer pushes encrypted rows to the server in the background. The import does not block on sync.
- **Fail-closed privacy.** Where SP privacy semantics don't map cleanly to Pluralscape buckets, the most restrictive translation wins.
- **Mobile-only client at this stage.** The engine package is RN-compatible (no Node-only dependencies) so a future web client can reuse it.
- **No UI in this epic.** The data layer ships hooks and service modules; the wizard UI is deferred to ps-9uqg.

## Goals

- Import every user-content collection in SP that has a Pluralscape destination, with category-level opt-out.
- Idempotent re-imports: re-running the import on the same SP source updates existing entities rather than creating duplicates.
- Resumable: a killed or interrupted import can be resumed from the last checkpoint without losing work.
- Honest reporting: per-collection counts of imported, updated, skipped, and failed entities, with a structured error log.
- Test coverage matching the project's 85% threshold; integration coverage of the full pipeline against a real database.

## Non-goals

- The wizard UI, screens, UX writing, accessibility audit (ps-9uqg).
- Importing SP reminders (`automatedReminders`, `repeatedReminders`) — Pluralscape has no equivalent feature; tracked in ps-20rq.
- Importing SP operational data: analytics events, system messages, generated reports, auth tokens, security logs, notification queues, billing.
- A web client. The package is RN-compatible but no web frontend is built here.
- Performance benchmarks or rate-limit prediction. We use exponential backoff against SP and accept that one-time-per-user imports don't need elaborate throttling.

## Architecture

Three runtime locations:

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile client (Expo)                                       │
│                                                             │
│   ┌─────────────────────────┐    ┌────────────────────┐    │
│   │  @pluralscape/import-sp │◄──►│  mobile-persister  │    │
│   │  (engine + mappers)     │    │  + token storage   │    │
│   └────────────┬────────────┘    │  + avatar fetcher  │    │
│                │                  └────────┬───────────┘    │
│                │                           │                │
│                ▼                           ▼                │
│        ┌───────────────┐          ┌───────────────────┐    │
│        │ ImportSource  │          │  Local SQLite     │    │
│        │  (api / file) │          │  (encrypted rows) │    │
│        └───────┬───────┘          └─────────┬─────────┘    │
└────────────────┼───────────────────────────┼───────────────┘
                 │                            │
                 │ HTTPS (token)              │ CRDT sync
                 ▼                            ▼
       ┌─────────────────────┐     ┌────────────────────────┐
       │  Simply Plural API  │     │  Pluralscape server    │
       │  api.apparyllis.com │     │  - import_jobs         │
       │                     │     │  - import_entity_refs  │
       │                     │     │  - encrypted entity    │
       │                     │     │    rows (sync target)  │
       └─────────────────────┘     └────────────────────────┘
```

The Pluralscape server never sees plaintext SP data and never holds the SP token. It manages job lifecycle metadata and an opaque dedup index keyed by source entity IDs (which are SP MongoDB ObjectIds — non-identifying on their own).

## Components

### New package: `packages/import-sp/`

Pure data-layer package. No UI, no React Native dependencies in the engine itself (mobile-only concerns live in the mobile glue). Sibling to a future `packages/import-pk/`.

```
packages/import-sp/
├── src/
│   ├── sources/
│   │   ├── source.types.ts        # ImportSource interface
│   │   ├── api-source.ts          # SP API client, pagination, retries
│   │   └── file-source.ts         # Streaming JSON parser + ZIP reader
│   ├── validators/
│   │   └── sp-payload.ts          # Zod schemas for every SP collection
│   ├── mappers/
│   │   ├── context.ts             # IdTranslationTable, warnings, lookups
│   │   ├── member.mapper.ts
│   │   ├── custom-front.mapper.ts
│   │   ├── group.mapper.ts
│   │   ├── field-definition.mapper.ts
│   │   ├── field-value.mapper.ts
│   │   ├── fronting-session.mapper.ts
│   │   ├── fronting-comment.mapper.ts
│   │   ├── journal-entry.mapper.ts  # SP notes -> JournalEntry
│   │   ├── poll.mapper.ts
│   │   ├── poll-vote.mapper.ts
│   │   ├── channel.mapper.ts
│   │   ├── channel-category.mapper.ts
│   │   ├── chat-message.mapper.ts
│   │   ├── board-message.mapper.ts
│   │   ├── bucket.mapper.ts
│   │   ├── friendship.mapper.ts
│   │   ├── system-profile.mapper.ts   # users cherry-picks -> systems.encryptedData
│   │   └── system-settings.mapper.ts  # private cherry-picks -> system_settings.encryptedData
│   ├── engine/
│   │   ├── import-engine.ts       # Orchestrator
│   │   ├── dependency-order.ts    # Topological sort of collection order
│   │   └── checkpoint.ts          # Checkpoint state read/write
│   ├── persistence/
│   │   └── persister.types.ts     # Persister interface
│   └── index.ts
├── test-fixtures/
│   ├── minimal.sp-export.json
│   ├── realistic.sp-export.json
│   ├── large.sp-export.json
│   ├── corrupted.sp-export.json
│   └── realistic.avatars.zip
├── scripts/
│   ├── build-fixtures.ts          # Generate fixtures programmatically
│   └── manual-import.ts           # Dev smoke-test against a real export
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Mobile glue: `apps/mobile/src/features/import-sp/`

Service layer only — no screens.

```
apps/mobile/src/features/import-sp/
├── mobile-persister.ts            # Persister impl: encrypt + write to local SQLite
├── sp-token-storage.ts            # expo-secure-store wrapper, persist toggle
├── avatar-fetcher.ts              # Concurrent HTTP fetcher / ZIP reader
├── import.hooks.ts                # React Query hooks for the future UI
└── __tests__/
```

The hooks form the contract that the wizard UI (ps-9uqg) will consume:

```ts
useStartImport(): {
  startWithToken: (token: string, opts: ImportOptions) => Promise<ImportJobId>
  startWithFile:  (jsonUri: string, zipUri: string | null, opts: ImportOptions) => Promise<ImportJobId>
}

useImportJob(jobId: ImportJobId): { data, isLoading, error }
useImportProgress(jobId: ImportJobId): {
  progressPercent: number
  currentCollection: ImportEntityType | null
  processedItems: number
  totalItems: number
  errorCount: number
}
useImportSummary(jobId: ImportJobId): {
  perCollection: Record<ImportEntityType, { imported, updated, skipped, failed }>
  errors: ImportError[]
}
useResumeActiveImport(): { activeJob: ImportJob | null, resume: () => Promise<void> }
useCancelImport(jobId: ImportJobId): { cancel: () => Promise<void> }
```

`ImportOptions` carries the category opt-out flags, the avatar mode (`api` | `zip` | `skip`), and `persistToken: boolean` (defaults `false`).

### Server: `apps/api/src/routers/import.router.ts`

| Procedure                | Type               | Purpose                                                                                                                                                        |
| ------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import.createJob`       | mutation           | Inserts a row in `import_jobs` (status `pending`); returns `ImportJobId`.                                                                                      |
| `import.updateProgress`  | mutation           | Atomic update of `progress_percent`, `chunks_completed`, `error_log` (append), `checkpoint_state`, `status`. Etag-locked.                                      |
| `import.completeJob`     | mutation           | Terminal — sets `completed_at`, final status.                                                                                                                  |
| `import.failJob`         | mutation           | Terminal — fatal error; sets status `failed` with optional `recoverable` flag in `checkpoint_state`.                                                           |
| `import.cancelJob`       | mutation           | Terminal — `failed` with `recoverable: false`. No rollback of imported entities.                                                                               |
| `import.getJob`          | query              | Single job by ID.                                                                                                                                              |
| `import.listJobs`        | query              | All import jobs for the current system, paginated.                                                                                                             |
| `import.subscribeJob`    | subscription (SSE) | Live progress events; backed by the M3 subscription infrastructure.                                                                                            |
| `entityRefs.lookupBatch` | query              | Given `(source, sourceEntityType, sourceEntityIds[])`, returns existing `pluralscape_entity_id` for each. Used at import start to seed the IdTranslationTable. |
| `entityRefs.upsertBatch` | mutation           | Upsert a batch of `(sourceEntityType, sourceEntityId, pluralscapeEntityId)` triples. Idempotent.                                                               |

REST mirrors for every procedure (per the project's "every endpoint needs both REST and tRPC" rule); `pnpm trpc:parity` must pass.

## Data flow

### Mode A — Simply Plural API token

1. User starts the import in the wizard (future ps-9uqg), pastes their SP bearer token, optionally checks "Remember this token", clicks Begin.
2. Token stored in `expo-secure-store` (iOS Keychain / Android Keystore). The persistence flag determines whether the token survives a terminal job status.
3. Client calls `import.createJob` → server returns `ImportJobId`.
4. Client calls `entityRefs.lookupBatch` for `(source: "simply-plural")` to seed the IdTranslationTable from prior imports.
5. Engine iterates collections in dependency order (see below). For each collection:
   - `ImportSource.iterate(collectionName)` yields raw documents one at a time. The API source paginates SP API endpoints; the file source streams from a JSON parser.
   - For each document:
     1. Validate against the corresponding Zod schema. On failure: `Persister.recordError({fatal: false})`, skip.
     2. Look up `(source, entityType, sourceId)` in the IdTranslationTable. Match → reuse the existing Pluralscape ID (update path). No match → generate a new Pluralscape ID, add it to the table.
     3. Call the entity's mapper. Mappers are pure functions over the raw document and the context.
     4. `Persister.upsertEntity(entity)` encrypts with the appropriate bucket key, writes to local SQLite, queues a source-ref upsert.
   - Every 50 documents (chunk boundary):
     - Flush queued source-ref upserts via `entityRefs.upsertBatch`.
     - Call `import.updateProgress` with `chunks_completed++`, current `progress_percent`, accumulated error log delta, and the new `checkpoint_state`.
     - Persist a local checkpoint marker so a crash before the next checkpoint loses at most 50 entities, all idempotently re-mappable on resume.
6. After the last collection: client calls `import.completeJob`, the avatar fetcher drains its queue, and (if persistence flag is false) the token is wiped.
7. The CRDT sync layer pushes encrypted entity rows to the server asynchronously. The user sees their imported data on other devices once sync completes.

### Mode B — JSON file (+ optional avatar ZIP)

1–3. Same as mode A. 4. User picks files via the OS document picker. JSON required, avatar ZIP optional. Picker returns local URIs. 5. The file source opens the JSON via a streaming tokenizer (RN-compatible) so a 50MB export does not blow up the heap on lower-end Android devices. Documents are yielded grouped by collection name. 6. Steps 6 onward identical to mode A from step 5 onward. 7. Avatar fetcher reads from the ZIP entry index instead of HTTP. Entries are member `_id`-keyed; the fetcher resolves them to imported member IDs via the IdTranslationTable. ZIP not provided → step skipped silently.

### Dependency order

Topologically sorted so cross-references resolve. Implemented in `engine/dependency-order.ts`:

```
buckets
  → customFields (definitions only)
  → customFronts (frontStatuses)
  → members
    → fieldValues (extracted from member.info)
    → groups
    → frontingSessions
      → frontingComments
    → notes -> journalEntries
  → channelCategories
    → channels
      → chatMessages
  → boardMessages
  → polls
    → pollVotes
  → friendships
  → system settings (cherry-picked from users + private)
```

`automatedReminders` and `repeatedReminders` are not in the order — they are skipped (see "Known limitations").

### Real-time progress

Active device updates `import_jobs` at every checkpoint. Other devices subscribe via `import.subscribeJob` (tRPC SSE on the M3 infrastructure) and receive `{progressPercent, currentCollection, processedItems, totalItems, errorCount, lastErrorPreview}` events. A user can start an import on phone and watch from tablet. If the active device crashes, another device can resume from the same checkpoint after re-providing the token (mode A) or re-picking the file (mode B).

## Entity mapping

Source: SP MongoDB collections (verified against `https://github.com/ApparyllisOrg/SimplyPluralApi/tree/release`).
Target: Pluralscape entity types (verified against `packages/types/src/`).

| SP collection                                                 | PS target                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `members`                                                     | `members`                              | `desc` → `description`. SP single `color` preserved as the first/only color. `pkId` dropped. `info` map extracted into separate `field_values` rows (see below). `private`/`preventTrusted` translate to bucket assignments via the privacy translation pass. `frame`, `supportDescMarkdown`, `archivedReason`, `receiveMessageBoardNotifs` mapped where Pluralscape has equivalents; otherwise dropped with summary warning. `avatarUrl` triggers an avatar download (mode A) or ZIP lookup (mode B).                                                         |
| `frontStatuses` (legacy collection name for SP custom fronts) | `custom_fronts`                        | Direct mapping. Verified that `frontStatuses` is the underlying Mongo collection for what SP's API exposes as "custom fronts" (`/tmp/sp-api-source/src/api/v1/customFront.ts` and `startup.ts:59`).                                                                                                                                                                                                                                                                                                                                                            |
| `groups`                                                      | `groups`                               | Direct. Member-list FK references are resolved through the IdTranslationTable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `customFields`                                                | `field_definitions`                    | Definitions only — SP stores values inside each member doc. SP field type strings mapped to Pluralscape `FIELD_TYPES` enum; unknown types fall back to `text` with a warning.                                                                                                                                                                                                                                                                                                                                                                                  |
| (extracted from `members[].info`)                             | `field_values`                         | Each member's `info: {fieldId: "value"}` map yields one `field_values` row per `(member, fieldDefinition)` pair. The mapper resolves both IDs through the IdTranslationTable.                                                                                                                                                                                                                                                                                                                                                                                  |
| `frontHistory`                                                | `fronting_sessions`                    | `customStatus` → `comment` field on the session (the field at `packages/types/src/fronting.ts:22-23` is explicitly documented as "SP-compatible"). `member` resolves to either `memberId` or `customFrontId` based on the SP `custom` boolean. `live: true` → `endTime: null`.                                                                                                                                                                                                                                                                                 |
| `comments`                                                    | `fronting_comments`                    | SP comments only attach to `frontHistory` (enforced by `validateCollection` at `/tmp/sp-api-source/src/api/v1/comment.ts`). Direct 1:1 mapping to Pluralscape `FrontingComment` (`packages/types/src/fronting.ts:46`).                                                                                                                                                                                                                                                                                                                                         |
| `notes`                                                       | `journal_entries`                      | SP `note.member` becomes `JournalEntry.author = {entityType: "member", entityId}`. SP `title` → `JournalEntry.title`. SP `note` (markdown body) becomes a single `ParagraphBlock` in `JournalEntry.blocks`. SP `date` → `createdAt`. SP `color` and `supportMarkdown` dropped (no Pluralscape equivalent on journal entries).                                                                                                                                                                                                                                  |
| `polls`                                                       | `polls` (+ `poll_votes`)               | SP `name` → `title`, `desc` → `description`, `endTime` → `endsAt`, `custom` → `kind`. SP `allowAbstain`, `allowVeto` → direct (Pluralscape supports both at `packages/types/src/communication.ts:125-126`). Pluralscape extras `allowMultipleVotes`/`maxVotesPerMember` default to `false`/`1`. SP polls have no creator field — `createdByMemberId` is set to `null`; **schema change required: make this column nullable**. SP custom poll options → `PollOption[]`. SP embedded `votes[]` → individual `PollVote` rows; `vote === "veto"` → `isVeto: true`. |
| `channelCategories`                                           | `channels` (with `type: "category"`)   | Direct. Pluralscape models categories as channels with type discriminator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `channels`                                                    | `channels` (with `type: "channel"`)    | Parent category resolved through the IdTranslationTable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `chatMessages`                                                | `chat_messages`                        | Sender resolved to `MemberId` via the IdTranslationTable. Mentions, attachments, replies preserved when they reference imported entities.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `boardMessages`                                               | `board_messages`                       | Direct. `pinned` and `sortOrder` preserved if present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `privacyBuckets`                                              | `buckets`                              | Direct. Both systems use the same bucket-with-intersection privacy concept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `friends`                                                     | `friendships`                          | Direct. The remote SP user identity is preserved as an opaque source ref; no SP-side identifying data is imported.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pendingFriendRequests`                                       | pending friend requests (social layer) | Direct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `users` (cherry-pick)                                         | `systems.encryptedData`                | The system profile blob. Fields imported: system name (`username` in SP), system color, system avatar URL (uploaded as a blob via `avatar-fetcher`), default privacy bucket reference. Everything else dropped.                                                                                                                                                                                                                                                                                                                                                |
| `private` (cherry-pick)                                       | `system_settings.encryptedData`        | The preferences blob. Fields imported: locale, fronting notification toggle, message-board notification toggle. Everything else dropped. (Pluralscape stores app-lock / biometric flags in `system_settings` non-encrypted columns; SP has no equivalent so those columns stay at their defaults.)                                                                                                                                                                                                                                                             |
| `automatedReminders`                                          | (skipped)                              | No Pluralscape equivalent. Summary warning. Tracked in ps-20rq.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `repeatedReminders`                                           | (skipped)                              | No Pluralscape equivalent. Summary warning. Tracked in ps-20rq.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Skipped (not user content):**

- `events` — SP daily-aggregate usage telemetry (`{date, event, count}`). Verified at `/tmp/sp-api-source/src/api/v1/events.ts`.
- `messages` — SP team announcements (release notes, maintenance notices). Verified at `/tmp/sp-api-source/src/api/v1/messages.ts`.
- `reports` — Already-generated PDF/HTML report artifacts; user can regenerate after import.
- `sharedFront`, `privateFront`, `fronters` — Presentation state derivable from active `frontHistory`.
- `accounts`, `tokens`, `verifiedKeys`, `securityLogs`, `audit` — Auth and security.
- `dataExports`, `avatarExports`, `notifications`, `queuedEvents`, `undeliveredMessages`, `subscribers`, `usage`, `serverData` — Operational.

### Privacy translation

SP exposes `private: boolean` and `preventTrusted: boolean` per member, plus per-bucket assignments on the more recent SP versions (post-1.11 migration). Pluralscape uses bucket-based intersection privacy with **no built-in default buckets** — every bucket is user-created.

Translation rules, applied during the member mapper:

1. **SP version has bucket assignments** (`buckets[]` array present on the member doc): import the buckets directly via the bucket IdTranslationTable. SP's bucket names are preserved as-is on the Pluralscape side.
2. **Legacy SP version** (`private` / `preventTrusted` booleans only, no buckets): the import synthesizes three Pluralscape buckets at the start of the privacy pass — "Public", "Trusted", "Private" — and assigns members per the fail-closed rule:
   - `private: true` → assigned to **Private** only.
   - `private: false, preventTrusted: false` → assigned to **Public + Trusted**.
   - `private: false, preventTrusted: true` → assigned to **Public** only.
3. **Mixed signals or unparseable** → assigned to **Private** only (most restrictive).

The synthesized buckets are recorded in `import_entity_refs` with a synthetic source-entity-id (e.g., `synthetic:legacy-private`) so re-imports update them rather than creating duplicates. The dependency order guarantees the bucket synthesis happens before any member is mapped.

If the user already has buckets in Pluralscape with the same names ("Public", "Trusted", "Private"), the synthesizer reuses them — matched by name, case-insensitively, scoped to the current system.

## Schema changes

Three changes to existing Pluralscape schema, plus one new table:

### New table: `import_entity_refs`

Server-side dedup index. T3 operational metadata. Same RLS pattern as `import_jobs`.

```sql
CREATE TABLE import_entity_refs (
  id                       UUID PRIMARY KEY,
  account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  system_id                UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  source                   VARCHAR(32) NOT NULL,    -- 'simply-plural' | 'pluralkit'
  source_entity_type       VARCHAR(64) NOT NULL,    -- 'member' | 'group' | 'fronting_session' | ...
  source_entity_id         VARCHAR(64) NOT NULL,    -- opaque SP _id
  pluralscape_entity_id    VARCHAR(32) NOT NULL,    -- target entity ID; no FK (multiple target tables)
  imported_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (account_id, system_id, source, source_entity_type, source_entity_id)
);
CREATE INDEX import_entity_refs_pluralscape_entity_id_idx
  ON import_entity_refs (pluralscape_entity_id);
CREATE INDEX import_entity_refs_account_system_idx
  ON import_entity_refs (account_id, system_id);

-- RLS: same dual policy as import_jobs (account-scoped + system-scoped)
```

- Built in **both** `packages/db/src/schema/pg/import-export.ts` AND `packages/db/src/schema/sqlite/import-export.ts`.
- Branded ID `ImportEntityRefId` and interface `ImportEntityRef` added to `packages/types/src/import-export.ts`.
- Source-entity-type enum reused from existing `ImportEntityType` (`packages/types/src/import-export.ts:189`); the import-export refs table type column should be a CHECK against the same enum array (`IMPORT_ENTITY_TYPES`) added to `packages/db/src/helpers/enums.ts`.
- New Drizzle migration; `0001_rls_all_tables.sql` regenerated; the test reference at `packages/db/src/__tests__/rls-migrations.integration.test.ts` updated.
- Integration tests for both PG and SQLite dialects following the existing `schema-pg-import-export.integration.test.ts` and `schema-sqlite-import-export.integration.test.ts` patterns.

### Existing table change: `import_jobs.checkpoint_state`

Add a `checkpoint_state JSONB` column for engine resumption state. Separate from `error_log` so the latter stays a pure error array.

```sql
ALTER TABLE import_jobs ADD COLUMN checkpoint_state JSONB;
```

Schema for the JSON contents (typed in `@pluralscape/types`):

```ts
interface ImportCheckpointState {
  schemaVersion: 1;
  checkpoint: {
    completedCollections: ImportEntityType[];
    currentCollection: ImportEntityType;
    currentCollectionLastSourceId: string | null;
  };
  options: {
    selectedCategories: Record<string, boolean>;
    avatarMode: "api" | "zip" | "skip";
  };
  totals: {
    perCollection: Record<
      ImportEntityType,
      {
        total: number;
        imported: number;
        updated: number;
        skipped: number;
        failed: number;
      }
    >;
  };
}
```

Mirrored in the SQLite dialect.

### Existing table change: `polls.created_by_member_id` becomes nullable

SP polls have no creator concept. Pluralscape currently requires `createdByMemberId: MemberId` (`packages/types/src/communication.ts:113`). Change to `MemberId | null` in the type and `NULL` in both PG and SQLite columns. Migration drops the NOT NULL constraint. Existing rows are unaffected.

### Existing type change: `ImportError.recoverable`

Add `readonly recoverable: boolean` to `ImportError` (`packages/types/src/import-export.ts:213`). Defaults to `false` for backwards compatibility. Used by the engine to distinguish errors that allow resume from those that require restarting.

## Error handling and resumption

### Error policy

Per-entity errors are recoverable: log to the job's `error_log`, skip the entity, continue. Whole-import errors are fatal: mark the job `failed` and either preserve resumability (`recoverable: true`) or not (`recoverable: false`).

| Error class                                      | `entityType`                | `fatal` | `recoverable` | Behavior                     |
| ------------------------------------------------ | --------------------------- | ------- | ------------- | ---------------------------- |
| Single-entity validation/mapping failure         | the failing entity's type   | `false` | n/a           | Skip, continue               |
| FK to a previously-failed entity                 | the dependent entity's type | `false` | n/a           | Skip, continue               |
| SP API 401 (token rejected)                      | `unknown`                   | `true`  | `true`        | Pause, prompt for token      |
| SP API rate-limit exhaustion (after retries)     | `unknown`                   | `true`  | `true`        | Pause, allow resume          |
| Network unreachable (after retries)              | `unknown`                   | `true`  | `true`        | Pause, allow resume          |
| Top-level JSON parse failure                     | `unknown`                   | `true`  | `false`       | Fail; user must fix the file |
| Persister write failure (key missing, disk full) | n/a                         | `true`  | `false`       | Fail                         |

### Checkpointing

Checkpoint state is written to `import_jobs.checkpoint_state` at every chunk boundary (every 50 entities). The state captures:

- Which collections are fully drained (`completedCollections`).
- The collection currently being imported (`currentCollection`).
- The last successfully persisted source ID within that collection (`currentCollectionLastSourceId`).
- The user's category opt-out flags and avatar mode.
- Per-collection running totals.

### Resumption algorithm

1. On app launch, the mobile glue queries `import.getJob` for any active job (`pending` | `validating` | `importing`, plus `failed` with `recoverable: true`).
2. If found, the engine reconstructs the `ImportSource`:
   - **Mode A** with persisted token: ImportSource ready immediately.
   - **Mode A** without persisted token: prompt user to re-enter token.
   - **Mode B**: file URI may have been revoked by the OS sandbox. If invalid, fail with `recoverable: false` ("source file no longer accessible").
3. Engine seeks to `currentCollection`, then iterates while skipping any source ID up to and including `currentCollectionLastSourceId`.
4. Engine reconstructs the IdTranslationTable by calling `entityRefs.lookupBatch` for the completed collections plus the current collection's processed range.
5. Resumes the normal pipeline.

### Cancellation

`import.cancelJob` is a special terminal failure: status `failed`, `recoverable: false`. **No rollback** — entities already imported stay (the import is additive and idempotent per the source-ref dedup), and the user can re-import to add the missing entities.

### Idempotency invariants

- Re-running the same import on the same SP source produces the same `pluralscape_entity_id` for every source entity (the IdTranslationTable is loaded from `import_entity_refs` at start).
- Mappers are pure; the persister checks the IdTranslationTable before generating new IDs.
- Updates respect the existing `versioned()` audit pattern: version increments, `updated_at` advances, sync layer propagates the change.
- The local SQLite write and the server `entityRefs.upsertBatch` are separate operations. If local write succeeds but server upsert fails, the next checkpoint retries (idempotent). Eventual consistency is acceptable.

## Testing strategy

### Unit tests — `packages/import-sp/src/__tests__/`

| File                              | Coverage                                                                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validators/sp-payload.test.ts`   | Every Zod schema accepts known-good fixtures, rejects malformed variants (missing required fields, wrong types, invalid enums). Branch coverage on every refinement.                                                                                            |
| `mappers/<entity>.mapper.test.ts` | One file per mapper. Happy path, null/empty edge cases, missing optional fields, malformed-but-recoverable input, cross-reference resolution against a stub IdTranslationTable. The members mapper specifically covers the `info` map → field-value extraction. |
| `engine/dependency-order.test.ts` | Topological sort produces a valid order; no cycles; missing collections handled.                                                                                                                                                                                |
| `engine/checkpoint.test.ts`       | Checkpoint state round-trips through serialization; resume reconstruction picks up correct collection and lastSourceId.                                                                                                                                         |
| `engine/import-engine.test.ts`    | End-to-end engine pipeline against a fake `Persister` and a fake `ImportSource`. Verifies dependency order, error recording, chunk-boundary checkpointing, terminal completion.                                                                                 |
| `sources/file-source.test.ts`     | Streaming JSON parser yields correct documents; ZIP companion reads avatar entries; truncated/corrupt input surfaces a `fatal: true` error.                                                                                                                     |
| `sources/api-source.test.ts`      | Mocks SP HTTP responses; pagination, retry on 429, fatal-on-401, response shape validation.                                                                                                                                                                     |

### Integration tests — `packages/import-sp/src/__tests__/*.integration.test.ts`

| File                                     | Coverage                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.full-import.integration.test.ts` | Real Postgres. Loads the realistic fixture, runs the full engine through a real `Persister`. Asserts every entity type lands correctly; encrypted blobs decrypt; `import_entity_refs` rows match; second run is idempotent.                    |
| `engine.resume.integration.test.ts`      | Imports half a fixture, kills the engine mid-collection, resumes from checkpoint. Asserts total counts match a clean run, no duplicates, final status `completed`.                                                                             |
| `engine.errors.integration.test.ts`      | Fixture with deliberate corruption (one bad member, one bad fronting session, one orphan field value). Asserts errors logged + recoverable, bad entities skipped, good entities imported, final status `completed` with non-empty `error_log`. |

### Server router integration tests — `apps/api/src/routers/__tests__/import.router.integration.test.ts`

- `import.createJob` lifecycle: pending → importing → completed.
- `import.updateProgress` etag conflict handling.
- `entityRefs.upsertBatch` idempotency: calling twice with the same payload does not double-insert.
- `entityRefs.lookupBatch` filters by source + entity type correctly.
- RLS enforcement: a user from system A cannot read system B's import jobs or entity refs.
- Cascade behavior: deleting an account purges its `import_jobs` and `import_entity_refs`.

### E2E tests — `apps/api-e2e/tests/import-sp.spec.ts`

- Authenticate, create system, drive an import end-to-end through the tRPC procedures, verify the resulting system state via standard read APIs.
- Subscription delivers progress events.
- Final summary returned at completion.
- Uses a small fixture so the full flow runs in <30s.

### Fixture files — `packages/import-sp/test-fixtures/`

| File                       | Contents                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `minimal.sp-export.json`   | One member, one front, one custom field. Smoke test.                                                  |
| `realistic.sp-export.json` | ~20 members, ~50 fronting sessions, every entity type represented at least once.                      |
| `large.sp-export.json`     | ~200 members, ~5,000 fronting sessions, ~1,000 chat messages. Performance and chunk-boundary testing. |
| `corrupted.sp-export.json` | Mix of valid and invalid entities for the errors integration test.                                    |
| `realistic.avatars.zip`    | Companion ZIP for the realistic fixture, placeholder PNG bytes per member ID.                         |

Generated programmatically by `packages/import-sp/scripts/build-fixtures.ts` so they stay in sync with SP schemas as edge cases are discovered.

### Manual smoke-test script — `packages/import-sp/scripts/manual-import.ts`

Bun script that takes an SP export path as argv, connects to the local dev API, authenticates as a test account, drives the engine end-to-end, and prints per-collection counts and errors. Not part of CI; for developer use against real exports.

### Coverage

Project's standard 85% line/branch/function/statement threshold. Mappers and validators are pure functions and should hit 95%+ trivially; the engine hits 85%+ via the integration tests.

## Known limitations

1. **Reminders not imported.** SP `automatedReminders` and `repeatedReminders` are skipped because Pluralscape has no equivalent feature. Tracked in ps-20rq. The import summary surfaces the count of skipped reminder entities so users know what's missing.
2. **Some SP member fields dropped.** Fields like `preventsFrontNotifs`, `receiveMessageBoardNotifs`, `frame`, `supportDescMarkdown` are dropped if Pluralscape has no equivalent on the target entity. Surfaced in the per-import summary as warnings.
3. **Custom field type fidelity.** SP custom field types are mapped to Pluralscape `FIELD_TYPES` enum where they exist; unknown SP types fall back to `text` with a per-field warning.
4. **Friend-relationship import is one-sided.** Imports only the local user's view of the friendship. Reciprocal handshake on the friend's side requires the friend to also use Pluralscape and is out of scope.
5. **Avatar fetching can fail per-entity.** A failed avatar fetch does not fail the member import — the member is created without an avatar, and the failure is logged.
6. **Mode B file URIs may be revoked between resume attempts on Android.** If the OS sandbox revokes the URI, resume fails with `recoverable: false` and the user must re-pick the file. The checkpoint is preserved as a "this is where we got" marker.

## Out-of-band concerns

- **SP API rate limits.** Exponential backoff (1s, 2s, 4s, 8s, 16s) on 429s, then surface as a recoverable failure. No predictive throttling.
- **Token revocation by user.** If the user revokes their SP token mid-import, the next API call returns 401, the engine pauses with `recoverable: true`, and the user can re-enter a fresh token.
- **Two-phase commit.** Not used. Local write and remote ref upsert are separate operations; idempotent retries reach eventual consistency.

## References

- SP API source: `https://github.com/ApparyllisOrg/SimplyPluralApi/tree/release` (mirrored locally during design at `/tmp/sp-api-source` for verification)
- Pluralscape encryption model: ADRs in `docs/adr/` (in particular ADR 002 — encryption tiers)
- Existing import infrastructure beans: types-lzek (import/export types), db-rcgj (import/export tracking tables), db-oxge (importJobs.source metadata leakage)
- Pluralscape entity types referenced: `packages/types/src/fronting.ts`, `packages/types/src/communication.ts`, `packages/types/src/journal.ts`, `packages/types/src/import-export.ts`
- Pluralscape schemas referenced: `packages/db/src/schema/pg/members.ts`, `packages/db/src/schema/pg/custom-fields.ts`, `packages/db/src/schema/pg/fronting.ts`, `packages/db/src/schema/pg/import-export.ts`, `packages/db/src/schema/pg/timers.ts`
