---
# api-5r51
title: Friend data E2E tests and OpenAPI
status: todo
type: feature
created_at: 2026-03-26T16:05:47Z
updated_at: 2026-03-26T16:05:47Z
parent: client-q5jh
blocked_by:
  - api-uyp6
---

E2E tests for paginated friend data export. Test scenarios: full pagination traversal across multiple pages, entity type filtering (members only, custom fronts only, mixed), visibility settings respected (untagged entities invisible), permission changes between pages (bucket unassigned mid-pagination), empty result set for no shared buckets, invalid/expired cursor returns 400, rate limiting enforced, key grants included on every page. OpenAPI spec additions. Files: apps/api-e2e/src/tests/friends/data.spec.ts (new).
