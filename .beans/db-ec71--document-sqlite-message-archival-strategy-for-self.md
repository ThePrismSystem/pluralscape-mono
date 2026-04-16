---
# db-ec71
title: Document SQLite message archival strategy for self-hosted
status: completed
type: task
priority: normal
created_at: 2026-03-12T20:23:02Z
updated_at: 2026-04-16T07:29:37Z
parent: ps-vtws
---

Document how self-hosted deployments should handle message archival in SQLite. PG uses partitioned tables for messages; SQLite needs a different strategy. Covers finding S2 from audit 004.

## Summary of Changes

Created docs/planning/sqlite-message-archival.md covering:

- Problem analysis: PG uses partitioning, SQLite cannot
- 4 options analyzed (time-based DELETE, archive table, WAL, file rotation)
- Recommended strategy: export-then-delete with detached SQLite sidecar file
- Retention configuration (env vars, defaults)
- Impact on sync (edge cases with long offline periods)
- Impact on message history (ATTACH DATABASE for transparent access)
- Implementation notes (idempotency, encryption, atomic export, testing)
