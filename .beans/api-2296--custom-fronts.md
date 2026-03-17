---
# api-2296
title: Custom fronts
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T21:40:23Z
parent: ps-rdqo
---

CRUD, treated like members in DB

### Deletion pattern

- DELETE endpoint returns 409 HAS_DEPENDENTS if custom front has dependents (fronting sessions referencing it)
- Response includes dependent entity types and counts
- Archival endpoint (PATCH archived: true) is always allowed regardless of dependents

## Summary of Changes\n\nAll custom front API endpoints implemented: CRUD, archival, restore.
