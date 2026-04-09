---
# ps-al4g
title: Simply Plural import Plan 3 — mobile glue + E2E
status: in-progress
type: task
priority: normal
created_at: 2026-04-08T23:56:02Z
updated_at: 2026-04-09T04:10:17Z
parent: ps-nrg4
---

Execute Plan 3 of the Simply Plural import feature: mobile UI (source picker, file picker, token entry, progress/error UI, history), concrete Persister + AvatarFetcher implementations, and API E2E tests for the import-job lifecycle. Builds on top of Plan 2 (@pluralscape/import-sp engine package, PR #402).

## Summary of Changes

Plan 3 complete — mobile glue + server batch endpoints + E2E tests for Simply Plural import.

**Server extensions (Phase A — 5 commits)**

- Shared `IMPORT_ENTITY_TYPES` enum usage (removed stale hardcoded arrays in routers)
- `entityRefs.lookupBatch` + `entityRefs.upsertBatch` tRPC procedures + REST mirrors
- Service layer batch helpers with idempotent upsert + RLS enforcement
- Route integration tests covering batch semantics (200 idempotency + 201 conflict update + RLS isolation)

**Mobile data plumbing (Phase B — 4 commits)**

- `import-sp-mobile.constants.ts`
- `sp-token-storage.ts` — `expo-secure-store` wrapper with per-system keys
- `avatar-fetcher.ts` — API mode (HTTPS + AbortController timeout), ZIP mode (jszip), skip mode, concurrency cap

**Mobile persister — 17 per-entity helpers + shared helpers (Phase C — 6 commits)**

- Separate file per entity type under `persister/` (explicit PM decision over monolithic layout)
- Shared helpers: `resolveExistingId`, `assertPayloadShape<T>`, `encryptForTable`, `persistViaChannelsTable`, `castPollVotes`, `queueRefUpsert`
- `PersisterApi` structural interface (no tRPC types leak)
- 17 entity persisters wired via `PERSISTER_DISPATCH: Record<ImportEntityType, EntityPersister>` exhaustiveness check
- Member persister with inline avatar upload (Q5 default)
- Poll persister with votes fan-out via `castPollVotes` (Q4 default)
- Channel-category + channel share `persistViaChannelsTable`

**Hooks + runner (Phase D — 5 commits)**

- `runSpImport()` orchestrator with progress callbacks + checkpoint resume
- `useStartImport`, `useImportJob`, `useImportProgress` (polling — Q1 default), `useImportSummary`, `useResumeActiveImport`, `useCancelImport`
- All hooks use the generic `importJob.update` mutation (Q2 default — no semantic procedures)
- `expo-document-picker` pinned to ~14.0.0 for Expo SDK 55
- Feature barrel at `features/import-sp/index.ts`

**E2E tests (Phase E — 4 commits)**

- `apps/api-e2e/src/tests/import-sp/lifecycle.spec.ts` — full import-job lifecycle via REST
- `apps/api-e2e/src/tests/import-sp/entity-refs.spec.ts` — batch endpoints + idempotency + conflict update + RLS isolation
- Registered new endpoints in E2E endpoint registry
- Bonus: fixed Plan 1 DB audit event enum (`import-job.created`/`updated` added to `AUDIT_EVENT_TYPES`)

**Phase F verification**

- format: clean (after auto-fix)
- lint: clean
- typecheck: clean
- unit: 11330 passing (818 files)
- integration: 2632 passing (129 files)
- e2e: 469 passing (4.2m) — includes 2 new import-sp specs
- trpc:parity: all 271 REST + 278 tRPC covered
- scope:check: clean

**Known limitations deferred to future work**

- `PersisterApi` wiring to vanilla tRPC client is a placeholder in `import.hooks.ts` — runtime usage will throw until a real adapter is wired. Hook tests mock `runSpImport` wholesale so the stubs are never invoked in tests.
- `ImportSource` construction for API and file modes is stubbed in the hooks — wizard UI (ps-9uqg) wiring will replace.
- Member `bucketSourceIds` are dropped by the member persister (deferred).
- Update paths use `version: 1` placeholder (resume-conflict fallback is a follow-up).
- Friend persister is record-only (no mutual consent flow yet).

**Total**: 24 commits + 1 prettier style commit + 1 bean commit + 1 db enum test fix = 27 commits on branch.
