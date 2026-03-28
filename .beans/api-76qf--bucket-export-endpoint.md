---
# api-76qf
title: Bucket export endpoint
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:05:59Z
updated_at: 2026-03-28T18:49:21Z
parent: client-vhga
blocked_by:
  - api-fc7h
---

GET /v1/systems/:systemId/buckets/:bucketId/export — owner-authenticated. Returns all entities tagged in bucket, organized by type, paginated. Reuses query helpers from db-xvkp. Files: apps/api/src/routes/buckets/export.ts (new), apps/api/src/services/bucket-export.service.ts (new), modify routes/buckets/index.ts. Tests: integration; correct entities, pagination, empty bucket, non-owner 404.

## Summary of Changes

- Created `apps/api/src/services/bucket-export.constants.ts` — `BUCKET_EXPORT_TABLE_REGISTRY` mapping all 21 entity types with JOIN-based query functions (no overfetch loop needed)
- Created `apps/api/src/services/bucket-export.service.ts` — `getBucketExportManifest` and `getBucketExportPage` with system ownership checks, RLS tenant context, and cursor pagination
- Created `apps/api/src/routes/buckets/export.ts` — manifest and paginated export endpoints with ETag/304 support
- Wired export route in `apps/api/src/routes/buckets/index.ts`
- Route unit tests in `apps/api/src/__tests__/routes/buckets/export.test.ts`
- Integration tests in `apps/api/src/__tests__/services/bucket-export.service.integration.test.ts`
