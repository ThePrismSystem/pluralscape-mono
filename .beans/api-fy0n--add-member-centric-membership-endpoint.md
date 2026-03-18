---
# api-fy0n
title: Add member-centric membership endpoint
status: todo
type: feature
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:12:33Z
parent: api-i2pw
---

Memberships only queryable from parent entity (groups/:id/members, subsystems/:id/memberships etc). No way to get all memberships for a specific member without N+1 queries. Add GET /systems/:systemId/members/:memberId/memberships. Ref: audit F-4.
