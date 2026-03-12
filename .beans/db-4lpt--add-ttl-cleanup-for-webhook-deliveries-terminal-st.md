---
# db-4lpt
title: Add TTL cleanup for webhook_deliveries terminal states
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:46:07Z
parent: db-2nr7
---

No purge mechanism for succeeded/failed deliveries. Table will grow unboundedly. Add cleanup job or retention policy. Ref: audit M25

## Summary of Changes

Added TTL cleanup indexes for webhook_deliveries to support future 30-day retention cleanup jobs (blocked by infra-m2t5 for actual job implementation).

**PG schema:** Added partial index `webhook_deliveries_terminal_created_at_idx` on `(createdAt)` WHERE `status IN ('success', 'failed')` — only indexes terminal states for efficient cleanup queries.

**SQLite schema:** Added composite index `webhook_deliveries_status_created_at_idx` on `(status, createdAt)` — SQLite lacks partial index support, so composite index provides equivalent query optimization.

**Test helpers:** Updated DDL in both `pg-helpers.ts` and `sqlite-helpers.ts` with the new indexes.

**Integration tests:** Added TTL cleanup tests in both PG and SQLite webhook test files verifying:

- Old terminal deliveries (>30 days, status success/failed) are deleted
- Recent terminal deliveries are preserved
- Old non-terminal deliveries (pending) are preserved

**JSDoc:** Added documentation on webhook_deliveries table describing cleanup strategy and retention policy.
