---
# api-e3hk
title: Privacy buckets
status: in-progress
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-26T20:21:24Z
parent: ps-6itw
---

CRUD, content tagging, intersection logic, fail-closed enforcement, custom field visibility per-bucket, three-tier encryption integration.

### Deletion pattern

Buckets: API returns 409 HAS_DEPENDENTS if content tags, key grants, friend assignments, field bucket visibility, or active key rotations exist (5 tables). Tags/grants/assignments: leaf entities, always deletable. Archival always allowed regardless of dependents.

### Scope (9 features)

- [x] 1.1 Type registrations for bucket domain events
- [x] 1.2 Bucket validation schemas
- [x] 1.3 Bucket CRUD service
- [x] 1.4 Bucket CRUD routes
- [x] 1.5 Content tag management
- [x] 1.6 Bucket access intersection logic
- [x] 1.7 Custom field bucket visibility
- [ ] 1.8 Bucket CRDT sync strategy
- [ ] 1.9 Bucket E2E tests + OpenAPI
