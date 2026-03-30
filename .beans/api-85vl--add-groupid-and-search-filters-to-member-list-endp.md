---
# api-85vl
title: Add groupId and search filters to member list endpoint
status: completed
type: task
priority: high
created_at: 2026-03-30T06:58:08Z
updated_at: 2026-03-30T08:03:55Z
parent: api-e7gt
---

Member list (GET /systems/:systemId/members) lacks groupId and search text query parameters. Client needs to filter members by group and search by name without fetching all members. Add groupId optional filter and search text filter to the list endpoint query schema and service.

## Summary of Changes

Implemented `groupId` optional filter on the member list endpoint. Added `MemberListQuerySchema` in the validation package with branded ID validation for `grp_` prefix. The service uses a subquery against `groupMemberships` to filter members belonging to the specified group. Note: `search` filter was dropped per design decision — member names are T1 encrypted (zero-knowledge), so server-side search is not possible; search runs client-side via FTS5 per spec §8.
