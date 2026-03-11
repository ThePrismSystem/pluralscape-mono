---
# db-hbkq
title: Fix import_jobs SQLite CHECK constraint NULL guard
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

PG: chunksCompleted <= chunksTotal WHERE chunksTotal IS NOT NULL. SQLite: chunksCompleted <= chunksTotal (no NULL guard). SQLite rejects inserts where chunksTotal IS NULL because 0 <= NULL is falsy. Blocks creating import jobs without known chunk count. Ref: audit H4
