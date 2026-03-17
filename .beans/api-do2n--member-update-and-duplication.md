---
# api-do2n
title: Member update and duplication
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-17T21:35:42Z
parent: api-b0nb
blocked_by:
  - api-ysx4
---

PUT /systems/:systemId/members/:id (full update with OCC). POST .../members/:id/duplicate (copy as Copy of {name}, optionally copy photos/fields/memberships, record discovery lifecycle event).

## Summary of Changes\n\nImplemented member update (PUT with OCC) and duplicate (POST with copyPhotos/copyFields/copyMemberships options) routes with service layer and route tests.
