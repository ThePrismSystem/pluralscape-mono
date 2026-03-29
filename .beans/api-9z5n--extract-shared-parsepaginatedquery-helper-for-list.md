---
# api-9z5n
title: Extract shared parsePaginatedQuery helper for list routes
status: todo
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T07:13:17Z
parent: api-kjyg
---

webhook-configs/list.ts and webhook-deliveries/list.ts have identical cursor + limit + query parsing boilerplate (also appears in member list routes). Extract a shared parsePaginatedQuery helper.
