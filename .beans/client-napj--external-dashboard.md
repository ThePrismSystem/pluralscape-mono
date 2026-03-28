---
# client-napj
title: External dashboard
status: in-progress
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-28T02:37:12Z
parent: ps-6itw
blocked_by:
  - api-e3hk
  - api-rl9o
---

Friend-facing data access: active fronters with custom fronts/status, member count, key grants — all filtered by privacy buckets. Summary-only dashboard; full data via paginated export (Epic 5). Uses service-role DB context with application-level assertFriendAccess gating.

### Scope (6 features)

- [x] 4.1 Friend access authorization module
- [x] 4.2 Bucket-scoped data query helpers
- [x] 4.3 Friend dashboard response types
- [x] 4.4 Friend dashboard endpoint
- [x] 4.5 Friend dashboard CRDT sync
- [ ] 4.6 Dashboard E2E tests + OpenAPI
