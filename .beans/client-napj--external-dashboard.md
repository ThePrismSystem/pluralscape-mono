---
# client-napj
title: External dashboard
status: todo
type: epic
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-26T16:06:37Z
parent: ps-6itw
blocked_by:
  - api-e3hk
  - api-rl9o
---

Friend-facing data access: active fronters with custom fronts/status, member count, key grants — all filtered by privacy buckets. Summary-only dashboard; full data via paginated export (Epic 5). Uses service-role DB context with application-level assertFriendAccess gating.

### Scope (6 features)

- [ ] 4.1 Friend access authorization module
- [ ] 4.2 Bucket-scoped data query helpers
- [ ] 4.3 Friend dashboard response types
- [ ] 4.4 Friend dashboard endpoint
- [ ] 4.5 Friend dashboard CRDT sync
- [ ] 4.6 Dashboard E2E tests + OpenAPI
