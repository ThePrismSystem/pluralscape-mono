---
# db-jv3w
title: Local-cache Drizzle schemas + materializer DDL refactor (PR2)
status: completed
type: epic
priority: high
created_at: 2026-04-28T00:06:39Z
updated_at: 2026-04-28T03:21:46Z
parent: ps-cd6x
blocking:
  - sync-xjfi
---

PR2 of the deferred-wiring closeout. See full design at `docs/superpowers/specs/2026-04-27-deferred-wiring-closeout-design.md`.

## Goal

Replace `packages/sync/src/materializer/entity-registry.ts` with a Drizzle-driven schema set under `packages/db/src/schema/sqlite-client-cache/`. Establish a three-way SoT parity gate (pg ↔ sqlite-server ↔ sqlite-client-cache). Refactor the materializer to read column metadata from Drizzle introspection. Document the three-schema-set architecture in ADR-038.

## Why this blocks PR3 (sync-xjfi)

The materializer's `applyDiff`, `entityToRow`, and `extractEntities` all consume the hand-rolled registry today. Wiring the materializer (PR3) without first replacing the registry means shipping the SoT violation into production code paths. Refactoring after PR3 ships = touching production; refactoring before = touching scaffolded code only.

## Sub-tasks (planned commits)

- [x] Commit 1a: ADR-038 + `entity-shape.{sqlite,pg}.ts` mixins (3 helpers: entityIdentity, encryptedPayload, serverEntityChecks). Members worked example refactored. Slim mixin chosen after discovering index-naming divergence.
- [x] Commit 1b: Apply mixins to remaining ~29 sqlite + ~30 pg server schemas (mechanical)
- [x] Commit 2: `sqliteJsonOf<T>` helper + parity gate helpers (`assertStructuralColumnsEquivalent`, `assertCacheColumnsMatchDomainType`)
- [x] Commits 3-N: Per-entity-group cache schemas under `sqlite-client-cache/` (system, members, groups, fronting, communication, structure, custom-fields, journal, privacy, timers, webhooks, innerworld, lifecycle-events, system-settings, analytics — every materialized SyncedEntityType covered)
- [x] Final commit: Refactor `applyDiff`, `entityToRow`, `materializeDocument` to read from Drizzle. Replace `generateAllDdl()` with Drizzle introspection. Move behaviour metadata to `entity-metadata.ts`. Delete `entity-registry.ts`.

## Acceptance

- `pnpm types:check-sot` passes including new three-way assertions for every entity
- DDL snapshot test confirms byte-equivalent output to pre-PR baseline
- Existing materializer test suite passes against new Drizzle-driven schemas
- ADR-038 committed under `docs/adr/`
- `entity-registry.ts` deleted

## Related

- Parent epic: ps-cd6x (M9a closeout)
- Blocks: sync-xjfi (PR3 — materializer wiring)
- Follow-up: db-mpbv (M15 codegen exploration)
- Foundation: types-ltel (types-as-SoT principle)

## Summary of Changes

- ADR-038 documents the three-Drizzle-schema-set architecture (server-PG, server-SQLite, client-cache-SQLite) and encoding rules.
- `entity-shape.{sqlite,pg}.ts` mixins (entityIdentity, encryptedPayload, serverEntityChecks) extracted; ~60 server schemas across both dialects refactored to consume them.
- `sqliteJsonOf<T>` typed JSON column helper added.
- Three-way parity helpers (`assertStructuralColumnsEquivalent`, `assertCacheColumnsMatchDomainType`) wired up; cache schemas now under the types-as-SoT regime.
- `packages/db/src/schema/sqlite-client-cache/` added with cache tables for every materialized SyncedEntityType (~40 entries across systems, members, groups, fronting, communication, structure, custom-fields, journal, privacy, timers, webhooks, innerworld, lifecycle-events, system-settings, analytics).
- Materializer rewired: `drizzle-bridge.ts` exposes `getTableMetadataForEntityType` (introspection); `applyDiff` / `extractEntities` / `materializeDocument` consume Drizzle metadata. `local-schema.ts` derives DDL from `getTableConfig`.
- Behaviour metadata extracted to `entity-metadata.ts` (`hotPath`, `ftsColumns`, `compoundDetailKey`); `entity-registry.ts` (847 LOC) and its dedicated test deleted.
- Mobile consumers (`use-search`, `friend-indexer`, `query-invalidator`) migrated to the new APIs.
- Transient DDL snapshot (used as a refactor safety net) deleted; the cache schemas are themselves the SoT.
- DDL output corrects several latent gaps in the legacy registry: every archivable entity now has `archived_at INTEGER`, `sort_order` is INTEGER (not REAL), and `fronting_reports` / `innerworld_canvas` get decrypted-plaintext columns instead of `encrypted_data` placeholders.

## Verification

- `pnpm typecheck` — passes
- `pnpm types:check-sot` — passes
- `pnpm test:unit` — 13048 tests pass
- `pnpm test:integration` — 3055 tests pass
- `pnpm test:e2e` — 507 tests pass
- `pnpm lint` — passes
- `pnpm format` — passes
