---
# api-b0nb
title: Member CRUD
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:46Z
updated_at: 2026-03-17T21:35:49Z
parent: ps-rdqo
---

Profiles, custom fields, multi-photo galleries with crop/resize, multiple colors, role tags, fragment/demi/full completeness, archival/restore

### Deletion pattern

- DELETE endpoint returns 409 HAS_DEPENDENTS if member has dependents (fronting sessions, group memberships, relationships, notes, field values, etc.)
- Response includes dependent entity types and counts
- Archival endpoint (PATCH archived: true) is always allowed regardless of dependents

## Summary of Changes\n\nComplete member domain API: CRUD for members, field definitions, field values, and photo galleries. All routes scoped under /systems/:systemId/members with auth, rate limiting, audit logging, OCC versioning, and blob validation. 16 new audit event types, system ownership helper, 8 Zod validation schemas, ~50 new files, 3057 tests passing.
