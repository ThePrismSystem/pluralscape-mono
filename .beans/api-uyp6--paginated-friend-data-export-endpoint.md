---
# api-uyp6
title: Paginated friend data export endpoint
status: todo
type: feature
created_at: 2026-03-26T16:05:42Z
updated_at: 2026-03-26T16:05:42Z
parent: client-q5jh
blocked_by:
  - api-ikfb
---

GET /v1/friends/:friendConnectionId/data with query params: entityTypes (filter), cursor, limit (default 50, max 200). Returns paginated encrypted entities + key grants on every page (or stable snapshot token; client detects rotation mid-stream and restarts). Reuses assertFriendAccess from api-ikfb and query helpers from db-xvkp. Files: apps/api/src/routes/friends/data.ts (new), apps/api/src/services/friend-data.service.ts (new), modify routes/friends/index.ts. Tests: integration; pagination traversal, entity type filtering, visibility settings respected, permission changes mid-pagination.
