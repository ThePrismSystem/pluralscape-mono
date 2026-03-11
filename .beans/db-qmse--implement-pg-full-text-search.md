---
# db-qmse
title: Implement PG full-text search
status: todo
type: task
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

SQLite has FTS5 virtual table with helpers. PG has no corresponding implementation — dialect capabilities doc says not yet implemented. All three audit models flagged this as a product gap for hosted PG deployments. Ref: audit H14
