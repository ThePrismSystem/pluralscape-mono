---
# db-oll6
title: "T2 db sqlite test splits: 9 schema files + sqlite-helpers"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T18:53:38Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Ten files in packages/db (sqlite scope) ≥750 LOC. See spec PR 5.

## Files (current LOC → target ≤500)

- [x] helpers/sqlite-helpers.ts (1,893) — split by responsibility
- [x] schema-sqlite-structure.integration.test.ts (1,795)
- [x] schema-sqlite-communication.integration.test.ts (1,519)
- [x] schema-sqlite-custom-fields.integration.test.ts (1,386)
- [x] schema-sqlite-privacy.integration.test.ts (1,335)
- [x] schema-sqlite-fronting.integration.test.ts (1,171)
- [x] schema-sqlite-auth.integration.test.ts (1,106)
- [x] schema-sqlite-notifications.integration.test.ts (914)
- [x] schema-sqlite-import-export.integration.test.ts (911)
- [x] schema-sqlite-timers.integration.test.ts (859)

## Acceptance

- pnpm vitest run --project db-integration passes
- Coverage unchanged or higher
- Every new file ≤500 LOC

## Out of scope

- Schema or migration changes
- pg-side files (separate bean)

## Summary of Changes

Merged via PR #593. All 10 originally-oversized SQLite integration test files (and the sqlite-helpers.ts helper) split into smaller files (each ≤500 LOC). All db-integration tests pass.
