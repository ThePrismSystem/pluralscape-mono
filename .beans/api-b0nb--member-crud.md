---
# api-b0nb
title: Member CRUD
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:46Z
updated_at: 2026-03-17T03:06:03Z
parent: ps-rdqo
---

Profiles, custom fields, multi-photo galleries with crop/resize, multiple colors, role tags, fragment/demi/full completeness, archival/restore

### Deletion pattern

- DELETE endpoint returns 409 HAS_DEPENDENTS if member has dependents (fronting sessions, group memberships, relationships, notes, field values, etc.)
- Response includes dependent entity types and counts
- Archival endpoint (PATCH archived: true) is always allowed regardless of dependents
