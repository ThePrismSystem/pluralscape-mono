---
# api-gkyb
title: Bucket export E2E tests and OpenAPI
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:06:05Z
updated_at: 2026-03-28T19:00:57Z
parent: client-vhga
blocked_by:
  - api-76qf
---

E2E tests for owner-authenticated bucket export endpoint. Test scenarios: export bucket with mixed entity types (members, custom fronts, groups, field values), pagination traversal with correct entity counts, empty bucket returns empty result, non-owner receives 404 (not 403), archived bucket export rejected, verify exported entities match tagged content exactly. OpenAPI spec additions. Files: apps/api-e2e/src/tests/buckets/export.spec.ts (new).

## Summary of Changes

- Created `apps/api-e2e/src/tests/buckets/export.spec.ts` — comprehensive E2E tests covering manifest (empty, tagged, ETag/304, non-owner 404), paginated export (mixed types, pagination traversal, empty, non-owner, archived, exact match, invalid type, full traversal)
- Created `docs/openapi/paths/bucket-export.yaml` — OpenAPI path definitions for manifest and paginated export endpoints
- Created `docs/openapi/schemas/bucket-export.yaml` — schema definitions for manifest entry/response, export entity, and page response
- Updated `docs/openapi/openapi.yaml` — added path references for bucket export endpoints
