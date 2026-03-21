---
# api-628l
title: Audit and fix N+1 query patterns in API routes
status: todo
type: task
priority: normal
created_at: 2026-03-13T19:09:37Z
updated_at: 2026-03-21T10:22:25Z
parent: api-0zl4
---

Review all API routes for N+1 query patterns (e.g. loading a list and then fetching related data per-row). Fix identified patterns using joins, batch queries, or dataloader patterns.
