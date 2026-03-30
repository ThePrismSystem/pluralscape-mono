---
# api-8f4i
title: Add friend dashboard sync projection endpoint
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T01:01:45Z
parent: api-e7gt
---

Only a basic GET dashboard endpoint exists. No sync/projection sub-resource for CRDT sync of friend dashboard data.

Audit ref: Domain 10, gap 5

## Summary of Changes\n\n- Created friend-dashboard-sync.service.ts returning per-entity-type sync state\n- Created GET /:connectionId/dashboard/sync route\n- Added FriendDashboardSyncEntry/Response types\n- 5 unit tests
