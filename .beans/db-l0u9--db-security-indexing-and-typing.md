---
# db-l0u9
title: DB security, indexing, and typing
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:37Z
updated_at: 2026-04-17T09:19:12Z
parent: ps-0enb
---

Low-severity DB findings from comprehensive audit.

## Findings

- [x] [DB-S-L1] Duplicate migration journal entries are deployment integrity risk
- [~] [DB-S-L2] audit_log.accountId/systemId nullable with set null (closed as invalid — intentional per ADR 017)
- [x] [DB-S-L3] notificationConfigs.enabled and pushEnabled default to true
- [x] [DB-P-L1] api_keys_revoked_at_idx indexes all rows; should use partial index
- [x] [DB-P-L2] sessions_ttl_duration_ms_idx expression index with no evident query consumer
- [x] [DB-P-L3] getStructureEntityAssociations round-trip camelCase transformation
- [x] [DB-T-L1] jobs.payload typed as unknown — no .$type<>()
- [x] [DB-TC-L1] views/mappers.ts has no unit test
- [x] [DB-TC-L2] No test for concurrent access patterns or FOR UPDATE lock semantics

## Summary of Changes

- **DB-S-L1**: Added `migrations-journal.test.ts` asserting unique tags,
  unique idxs, and sequential idx values.
- **DB-S-L2**: NOT CHANGED. `audit_log.accountId/systemId` SET NULL is
  intentional per ADR 017 for audit history preservation across account
  deletion. Closed as invalid.
- **DB-S-L3**: `notificationConfigs.enabled` and `pushEnabled` defaults
  flipped to `false` (fail-closed at DB layer). **Note:** service layer
  (`notification-config.service.ts`) and `switch-alert-dispatcher.ts`
  still treat absent config rows as "enabled". Follow-up needed for true
  end-to-end fail-closed semantics.
- **DB-P-L1**: `api_keys_revoked_at_idx` converted to partial index
  (`WHERE revoked_at IS NOT NULL`).
- **DB-P-L2**: `sessions_ttl_duration_ms_idx` dropped (no consumers found).
- **DB-P-L3**: `getStructureEntityAssociations` round-trip eliminated via
  explicit drizzle projection.
- **DB-T-L1**: `jobs.payload` annotated with `JobPayload` via
  `JobPayloadMap[JobType]` — single source of truth, no drift risk.
- **DB-TC-L1**: Unit tests added for `views/mappers.ts`.
- **DB-TC-L2**: Integration tests added at
  `apps/api/src/__tests__/integration/for-update-lock-semantics.integration.test.ts`
  covering poll-vote serialization, friend-code quota + redemption, and
  import-job state machine (including illegal transitions). PGlite limitation
  (no real lock contention) documented at the top of the file; true timing
  validation belongs in E2E.

Side-effect fix: `packages/queue/src/adapters/sqlite/row-mapper.ts` simplified
to match the new `JobPayload` typing (the previous `?? {}` fallback and
`Record<string, unknown>` cast became dead code).

Regenerated 0000 PG migration (new tag: `0000_sparkling_shockwave`) and
0001 RLS migration. Also flipped SQLite `notifications.ts` defaults to
preserve PG↔SQLite parity.
