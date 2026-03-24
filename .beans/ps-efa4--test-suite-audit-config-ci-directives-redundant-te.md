---
# ps-efa4
title: "Test suite audit: config, CI, directives, redundant test cleanup"
status: completed
type: task
priority: normal
created_at: 2026-03-24T12:07:44Z
updated_at: 2026-03-24T12:30:17Z
---

Coverage config cleanup (add type-only exclusions, raise threshold to 85%), merge CI unit+integration coverage, add testing directives to CLAUDE.md, fix observable-queue coverage, delete redundant type tests (barrel.test.ts, smoke.test.ts, expectTypeOf assertions)

## Summary of Changes

- **vitest.config.ts**: Added 27 type-only file exclusions (13 types, 8 sync schemas/adapters, 5 sync interfaces, 1 rotation-worker types). Raised coverage threshold from 80% to 85%.
- **ci.yml**: Merged test-unit and test-integration jobs into single 'test' job running combined coverage with Postgres + Valkey services.
- **CLAUDE.md**: Added Testing Directives section with unit/integration/E2E/coverage policy. Updated coverage threshold reference.
- **Deleted redundant tests**: barrel.test.ts (840 lines), smoke.test.ts, snapshot.test.ts, sync.test.ts, identity.test.ts — all pure type-level assertions.
- **Refactored**: replication-profiles.test.ts — replaced expectTypeOf with runtime assertions.
- **Added**: 7 pass-through delegation tests for ObservableJobQueue.
- **Fixed**: analytics.service.test.ts timeout (10k row test needs 15s).
- **Memory**: Added testing directives and save-test-output-to-file feedback.
- **Beans**: Created api-n8od (E2E gaps) and api-av4w (integration test gaps) for future work.
