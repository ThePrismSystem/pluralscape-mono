---
# api-y9zq
title: Add cursor pagination to field value list endpoints
status: todo
type: task
priority: high
created_at: 2026-03-30T06:58:10Z
updated_at: 2026-03-30T06:58:10Z
parent: api-e7gt
---

Field value lists for members/groups/structure entities return a simple {items} array without cursor/limit pagination. With up to 200 fields per entity (per spec), this could be problematic. Add cursor-based pagination consistent with other list endpoints.
