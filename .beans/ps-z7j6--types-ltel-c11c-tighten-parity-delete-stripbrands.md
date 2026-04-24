---
# ps-z7j6
title: "types-ltel C11c: tighten parity + delete StripBrands (epic closeout)"
status: completed
type: task
priority: high
created_at: 2026-04-24T09:27:17Z
updated_at: 2026-04-24T18:48:12Z
parent: types-ltel
blocked_by:
  - ps-ava1
---

Third and final sub-PR of C11. When this lands, the `types-ltel` epic closes.

## Scope

`__helpers__.ts` exports only `StripBrands`; `Equal` is already imported directly from `@pluralscape/types` in every parity test, so C11c is an outright deletion.

Per parity test file (57 files in `packages/db/src/__tests__/type-parity/*.type.test.ts`):

- [ ] Remove `import type { StripBrands } from "./__helpers__.js";`
- [ ] Rewrite `Equal<StripBrands<Row>, StripBrands<XServerMetadata>>` → `Equal<Row, XServerMetadata>`

Then:

- [ ] Delete `packages/db/src/__tests__/type-parity/__helpers__.ts`
- [ ] Update `types-ltel` epic body Fleet Progress: `- [x] Cluster 11 — Cleanup (...; PR #XXX)`
- [ ] Mark `types-ltel` status `completed` once the PR merges

## Negative verification (local, pre-PR)

Introduce a deliberate drift (e.g. change a `SystemId` column to plain `text()`). Confirm `pnpm typecheck` fails with a clear error pointing at the parity test. Revert.

## Acceptance

- `pnpm typecheck` green
- `pnpm test:integration` green
- `pnpm types:check-sot` green
- `grep -r StripBrands packages/db/` returns nothing
- `packages/db/src/__tests__/type-parity/__helpers__.ts` deleted
- `types-ltel` epic body Fleet Progress shows C11 checked
- `types-ltel` marked completed

## Spec

`docs/superpowers/specs/2026-04-24-types-ltel-c11-cleanup-design.md`

## Summary of Changes

**Commits on feat/types-ltel-c11c-parity-closeout:**

- 86160a5c refactor(types,db): resolve 8 parity drifts from StripBrands removal
- 39230ede test(db,api): update fixtures for branded-ID schema columns

**Mechanical changes:**

- Deleted `packages/db/src/__tests__/type-parity/__helpers__.ts` (StripBrands helper).
- Rewrote 56 parity test files: `Equal<StripBrands<Row>, StripBrands<X>>` → `Equal<Row, X>`.

**Drift fixes surfaced by strict parity:**

- AccountPurgeRequest, DeviceToken, FrontingComment, FrontingSession, Member — plain `varchar` ID columns flipped to `brandedId<XxxId>` (both PG and sqlite).
- AuditLogEntry — `DbAuditActor` now uses branded IDs, aligned with domain `AuditActor`.
- Note — `author_entity_type` typed `NoteAuthorEntityType`; `NoteServerMetadata.authorEntityId: string → AnyBrandedId`.
- SystemSettings — `locale` typed `Locale`; validation narrows to `z.enum(SUPPORTED_LOCALES)`.

**Fixture/API fallout:** pg-helpers, sqlite-helpers, 12 integration tests, 2 audit tests, 5 api service files, auth.constants, validation/settings. No migrations touched (type-only narrowing).

**/verify full suite green:** unit + integration + E2E (507 passed) + sp-import + pk-import.

**types-ltel epic closes with this commit.**
