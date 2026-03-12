---
# db-ec71
title: Document SQLite message archival strategy for self-hosted
status: todo
type: task
priority: normal
created_at: 2026-03-12T20:23:02Z
updated_at: 2026-03-12T20:23:02Z
---

Document how self-hosted deployments should handle message archival in SQLite. PG uses partitioned tables for messages; SQLite needs a different strategy. Covers finding S2 from audit 004.
