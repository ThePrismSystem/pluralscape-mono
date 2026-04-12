---
# ps-nrg4
title: Simply Plural import
status: completed
type: epic
priority: normal
created_at: 2026-03-31T23:13:07Z
updated_at: 2026-04-12T10:09:41Z
parent: ps-h2gl
---

Import flow UI, data mapping logic, progress/error handling, conflict resolution

## Implementation progress

### Plan 1 Phase A complete (types changes)

- bca407a8: feat(types): add recoverable field to ImportError (Task 1)
- 8a8abd58: feat(types): add ImportEntityRefId branded ID (Task 3)
- 63517d43: feat(types): add ImportCheckpointState and ImportEntityRef (Tasks 2+4)
- fe5918b3: feat(types): allow null Poll.createdByMemberId for imported polls (Task 5)

### Plan 1 complete (Tasks 1-27)

Foundation layer for SP import is in place: types, schemas, migrations, services, tRPC routers, REST routes, and full /verify pass.

- Task 14: db294ea1, 441bd9dd, fac66a74, 3a... (db schema + RLS + integration tests)
- Tasks 16-17: 2fa9e940, d6955f7e (zod validation schemas)
- Tasks 18-19: e6cdf72d, 6da0e9cf (services with PGlite integration tests)
- Tasks 20-21: f89de9fa, c4de47c1 (tRPC routers)
- Tasks 22-23: d11cc2bb (REST routes)
- Task 25: f704dd77 (tRPC parity mappings)
- Task 27: full /verify pass — 13948 unit + 2619 integration + 461 e2e tests passing

Next: write Plans 2 (import-sp package) and 3 (mobile glue + E2E).

### Plan 2 written

`docs/superpowers/plans/2026-04-08-simply-plural-import-plan-2-engine.md` — 31 tasks across 8 phases. Builds the `@pluralscape/import-sp` package: validators, sources (file/api/fake), 16 mappers, dependency-ordered orchestrator with checkpoint resume, fixtures, integration tests against in-memory persister. Mobile glue and E2E deferred to Plan 3.

Ready to execute via subagent-driven-development.

### Plan 2 complete (Tasks 1-30)

Built the `@pluralscape/import-sp` package end-to-end via subagent-driven development across 8 phases.

**Phases**

- Phase A: package scaffold, Persister/AvatarFetcher boundary types, constants
- Phase B: 20 raw SP interfaces + 17 Zod validators with `satisfies z.ZodType<T>` drift prevention
- Phase C1: ImportSource interface + FakeSource
- Phase C2: FileSource (clarinet streaming JSON) + ApiSource (retry/backoff)
- Phase D1: MappingContext, MapperResult discriminated union, bucket mapper + legacy synthesis
- Phase D2: custom-front, field-definition, field-value, member mappers
- Phase D3: group, fronting-session, fronting-comment, journal-entry, poll, channel-category, channel, chat-message, board-message, friendship, system-profile, system-settings mappers
- Phase E1: dependency-order, checkpoint, entity-type-map, engine-errors (with ResumeCutoffNotFoundError sentinel)
- Phase E2: mapper-dispatch table + runImport orchestrator with fatal/non-fatal/resume/legacy-synth paths
- Phase F+G: 4 fixtures (minimal, realistic, legacy-no-buckets, corrupted) + in-memory persister helper + 3 integration tests + manual smoke-test script
- Phase H: full /verify pass

**Fixes applied during review**

- Phase D3: journal author shape (EntityReference), board-message readBy dedupe, uniform mapper signatures
- Phase E1: canonical friend→friends override, boundary JSDoc, classifyError contract docs, non-Error branch coverage
- Phase E2: legacy synth trigger on mapped count (not yielded), removed dead shouldSkipBefore, resume cutoff abort path, delta helper refactor, iterator errors always fatal

**Final /verify results**

- format: clean
- lint: clean
- typecheck: clean
- unit: 11175 passing (790 files)
- integration: 2622 passing (129 files) — includes 3 new import-sp integration tests
- e2e: 461 passing (4.1m)
- trpc:parity: all 269 REST + 276 tRPC covered
- scope:check: clean

Next: Plan 3 — mobile glue (token entry, file picker, job lifecycle UI) + E2E tests against the engine.
