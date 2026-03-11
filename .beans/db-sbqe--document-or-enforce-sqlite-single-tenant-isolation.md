---
# db-sbqe
title: Document or enforce SQLite single-tenant isolation
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:47Z
parent: db-q3r3
---

SQLite isolation is advisory — just eq(column, value). FTS5 table has no system_id column. If SQLite is strictly single-tenant/per-device, document this boundary. Otherwise add tenant columns to all raw-SQL paths. Ref: audit H3
