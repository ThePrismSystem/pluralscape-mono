---
# api-3t0y
title: Friend dashboard endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:22Z
updated_at: 2026-03-29T00:48:46Z
parent: client-napj
blocked_by:
  - api-ikfb
---

GET /v1/friends/:friendConnectionId/dashboard. Returns: connection info, active fronters (with status), member count, key grants. Summary-only to avoid payload bloat. Rate limit: friendRead (30/min). Audit: friend.dashboard-viewed. Uses service-role DB context with assertFriendAccess gating. Files: apps/api/src/routes/friends/dashboard.ts (new), routes/friends/index.ts (new), modify routes/v1.ts. Tests: unit + integration; empty buckets, blocked connection, correct key grants.
