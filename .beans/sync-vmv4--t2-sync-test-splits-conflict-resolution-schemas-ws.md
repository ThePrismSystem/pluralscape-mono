---
# sync-vmv4
title: "T2 sync test splits: conflict-resolution, schemas, ws-client-adapter, document-lifecycle, sync-engine-runtime-hardening"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:01:01Z
updated_at: 2026-04-30T17:34:11Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Five test files in packages/sync ≥750 LOC. See spec docs/superpowers/specs/2026-04-29-test-file-split-epic-design.md PR 4. Each split follows Standard Split Workflow.

## Files (current LOC → target ≤500)

- [x] conflict-resolution.test.ts (1,548) → 4 files: conflict-resolution-{lww,junctions-links,tombstones,hierarchy,ordering-chat} + helpers/conflict-resolution-fixtures.ts
- [x] schemas.test.ts (1,087) → 4 files: schemas-{system-core,system-core-structure,fronting-chat,other-domains} + helpers/schema-fixtures.ts
- [x] adapters/ws-client-adapter.test.ts (1,043) → 5 files: ws-client-adapter-{handshake,routing,rpc-changes,rpc-snapshots,edge-cases} + helpers/ws-client-adapter-fixtures.ts
- [x] document-lifecycle.test.ts (909) → 3 files: document-lifecycle-{compaction,purging,time-archive} + helpers/document-lifecycle-fixtures.ts
- [x] sync-engine-runtime-hardening.test.ts (769) → 2 files: sync-engine-runtime-hardening-{batching,buffers} + helpers/runtime-hardening-fixtures.ts

## Acceptance

- pnpm vitest run --project sync passes
- pnpm vitest run --project sync --coverage shows coverage unchanged or higher
- Every new file ≤500 LOC (stretch 350)
- Original files deleted

## Out of scope

- Refactoring sync engine, conflict resolver, or any production code
- Files <750 LOC

## Summary of Changes

Split 5 oversized test files in `packages/sync/` into 18 smaller test files plus 5 shared helper files. All split files are ≤500 LOC. All 951 sync tests pass; lint, typecheck, and prettier are clean.

### Files split

| Original (LOC)                              | Split into                                                                                        | Helper                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| conflict-resolution.test.ts (1548)          | 5 files: lww (299), junctions-links (409), tombstones (276), hierarchy (188), ordering-chat (412) | helpers/conflict-resolution-fixtures.ts (88)                   |
| schemas.test.ts (1087)                      | 4 files: system-core (263), system-core-structure (219), fronting-chat (239), other-domains (254) | helpers/schema-fixtures.ts (149)                               |
| adapters/ws-client-adapter.test.ts (1043)   | 5 files: handshake (218), routing (195), rpc-changes (159), rpc-snapshots (201), edge-cases (193) | adapters/**tests**/helpers/ws-client-adapter-fixtures.ts (149) |
| document-lifecycle.test.ts (909)            | 3 files: compaction (347), purging (250), time-archive (328)                                      | helpers/document-lifecycle-fixtures.ts                         |
| sync-engine-runtime-hardening.test.ts (769) | 2 files: batching (406), buffers (329)                                                            | helpers/runtime-hardening-fixtures.ts (150)                    |

### Test count parity

- conflict-resolution: 28 → 28
- schemas: 40 → 40
- ws-client-adapter: 36 → 36
- document-lifecycle: 23 → 23
- sync-engine-runtime-hardening: 12 → 12

Total 139 tests preserved (no test removed or skipped). Full sync suite: 951 tests pass.

### DRY consolidations

- Extracted shared crypto-session setup (sodium init, makeKeys, makeSessions) to per-domain helpers.
- Extracted shared schema doc factories to a single `schema-fixtures.ts` helper.
- Extracted shared MockWebSocket / TestHarness for ws-client-adapter splits.
- Extracted shared SyncEngine bootstrap helpers to `runtime-hardening-fixtures.ts` (createBootstrappedEngine, mockStorageAdapter, relayNetworkAdapter, SYSTEM_CORE_MANIFEST).
