---
# ps-02ck
title: Extract shared E2E infra to test-utils & build PK E2E with real API server
status: completed
type: task
priority: normal
created_at: 2026-04-12T21:18:11Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-dvxb
---

Phase 1: Extract Docker, API server, account, tRPC client, crypto, persister-base, ref-helpers, and setup into @pluralscape/test-utils/e2e. Phase 2: Refactor import-sp E2E to use shared infra. Phase 3: Build import-pk E2E with real server persistence.

## Summary of Changes

Completed via PR: fix/pk-zero-duration-fronting-session branch.

- Added `entitiesByType()` to shared `InMemoryPersisterSnapshot`
- Deleted SP's duplicate `RecordingPersister`, migrated SP integration tests to shared `InMemoryPersister`
- Rewrote PK E2E tests as manifest-driven parameterized suites (file source, live API source, checkpoint resume)
- Rewrote PK E2E helpers with manifest loading, source factories, checkpoint helper
- Rewrote PK E2E entity assertions as manifest-driven
- Created PK manifest types shared by integration and E2E
- Updated PK seed script to populate manifest fields
- Fixed zero-duration fronting session bug (endTime bump by 1ms)
- All 33 PK E2E tests pass (file source + live API + checkpoint resume)
- All 63 SP E2E tests pass (including live API)
