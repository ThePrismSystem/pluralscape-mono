---
# client-napj
title: External dashboard
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-28T02:41:56Z
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
- [x] 4.6 Dashboard E2E tests + OpenAPI

## Summary of Changes

All 6 features implemented:

- **4.1** Friend access authorization module (`assertFriendAccess`) with `withCrossAccountRead` RLS helper
- **4.2** Bucket-scoped data query helpers for active fronting, members, custom fronts, structure entities, key grants
- **4.3** `FriendDashboardResponse` and related types in `@pluralscape/types`
- **4.4** `GET /account/friends/:connectionId/dashboard` endpoint with single-transaction orchestration
- **4.5** CRDT sync projection extending `BucketProjectionDocument` with `dashboardSnapshot`
- **4.6** E2E tests (friend dashboard lifecycle) and OpenAPI spec documentation

Key design decisions: system resolution via bucket assignments (not systems table), single transaction for access check + data fetch (TOCTOU prevention), FriendVisibilitySettings enforced client-side (zero-knowledge server), memberCount intentionally unfiltered, friend-facing projections in bucket docs (not privacy-config).
