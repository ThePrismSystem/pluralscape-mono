---
# db-zqyl
title: "Fix PR #71 review issues: kdfSalt type, SyncQueueItem seq, test hardening"
status: completed
type: task
priority: normal
created_at: 2026-03-12T06:51:21Z
updated_at: 2026-04-16T07:29:39Z
parent: db-2nr7
---

Address 2 critical, 6 important, and 4 suggestion issues from PR #71 review

## Summary of Changes

### Critical fixes

- `Account.kdfSalt` type changed from `string | null` to `string` (matches NOT NULL DB constraint)
- Added `readonly seq: number` to `SyncQueueItem` interface

### Important fixes

- Removed redundant inline `UNIQUE` on seq in PG test helper DDL (separate unique index exists)
- Added missing compound entity index to PG test helper DDL
- Added `rejects duplicate seq values` test for PG sync_queue
- Added `rejects duplicate (id, timestamp) pair` and `allows same id with different timestamp` tests for PG messages composite PK
- Fixed `seqCounter` isolation in SQLite sync tests with random starting offset
- Updated schema-type-parity test: kdfSalt is now a non-nullable column, not DB-only

### Suggestions implemented

- Added PARTITION BY warning comment above PG messages schema
- Added pre-release safety comment to PG migration
- Replaced all `as` type casts with proper narrowing in both PG and SQLite sync tests
- Added SQLite seq behavioral asymmetry comment
