---
# api-e3hk
title: Privacy buckets
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:01Z
parent: ps-6itw
---

CRUD, content tagging, intersection logic, fail-closed enforcement, custom field visibility per-bucket, three-tier encryption integration

### Deletion pattern

Buckets: API returns 409 HAS_DEPENDENTS if content tags, key grants, or friend assignments exist. Tags/grants/assignments: leaf entities, always deletable. Archival always allowed regardless of dependents.
