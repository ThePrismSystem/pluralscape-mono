---
# api-d0ej
title: SQLite communication schema
status: completed
type: task
priority: critical
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T10:51:53Z
parent: ps-53up
blocking:
  - api-ryy0
  - api-b46w
  - api-i16z
  - api-8lt2
  - api-vjmu
---

Create packages/db/src/schema/sqlite/communication.ts mirroring PG schema (channels, messages, board_messages, notes, polls, poll_votes, acknowledgements). Generate SQLite migrations. Tests: unit test verifying schema parity with PG. Shared dependency for all M5 epics.

## Summary of Changes

All work described in this bean already existed on main from prior commits:

- SQLite communication schema: `packages/db/src/schema/sqlite/communication.ts` (all 7 tables: channels, messages, boardMessages, notes, polls, pollVotes, acknowledgements)
- Schema parity tests: `packages/db/src/__tests__/schema-type-parity.test.ts` (covers all communication tables)
- SQLite migrations: `packages/db/migrations/sqlite/0000_talented_epoch.sql` (includes all communication DDL)

No additional code changes were needed.
