---
# api-fy0n
title: Add member-centric membership endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:48Z
parent: api-i2pw
---

Memberships only queryable from parent entity (groups/:id/members, subsystems/:id/memberships etc). No way to get all memberships for a specific member without N+1 queries. Add GET /systems/:systemId/members/:memberId/memberships. Ref: audit F-4.

## Summary of Changes

- Added `listMemberGroupMemberships` to `group-membership.service.ts` with cursor pagination by groupId
- Created `routes/members/memberships.ts` route handler
- Registered as `/:memberId/memberships` sub-route in `routes/members/index.ts`
