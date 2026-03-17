---
# api-tzme
title: Groups and folders
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T21:40:23Z
parent: ps-rdqo
---

CRUD, hierarchy, multi-membership, ordering, image/color/emoji, move/copy between folders

### Deletion pattern

- DELETE group returns 409 HAS_DEPENDENTS if group has child groups or group memberships
- DELETE group membership is always allowed (no dependents on junction rows)
- Archival endpoint (PATCH archived: true) is always allowed regardless of dependents

## Summary of Changes\n\nAll group API endpoints implemented: CRUD, hierarchy, archival, membership.
