---
# api-gkyb
title: Bucket export E2E tests and OpenAPI
status: todo
type: feature
created_at: 2026-03-26T16:06:05Z
updated_at: 2026-03-26T16:06:05Z
parent: client-vhga
blocked_by:
  - api-76qf
---

E2E tests for owner-authenticated bucket export endpoint. Test scenarios: export bucket with mixed entity types (members, custom fronts, groups, field values), pagination traversal with correct entity counts, empty bucket returns empty result, non-owner receives 404 (not 403), archived bucket export rejected, verify exported entities match tagged content exactly. OpenAPI spec additions. Files: apps/api-e2e/src/tests/buckets/export.spec.ts (new).
