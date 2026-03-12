---
# db-sbqe
title: Document or enforce SQLite single-tenant isolation
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T04:11:26Z
parent: db-q3r3
---

SQLite isolation is advisory — just eq(column, value). FTS5 table has no system_id column. If SQLite is strictly single-tenant/per-device, document this boundary. Otherwise add tenant columns to all raw-SQL paths. Ref: audit H3

## Summary of Changes

Documented the SQLite single-tenant isolation model in dialect-api-guide.md, explaining why FTS5 search_index omits system_id and how advisory WHERE clauses differ from PG RLS. Added inline comment to search.ts referencing the documentation.
