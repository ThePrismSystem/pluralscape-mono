---
# client-q5jh
title: Friend-side search
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-28T07:31:32Z
parent: ps-6itw
blocked_by:
  - client-napj
---

Paginated friend data export endpoint for client-side search. Friend's client pulls all bucket-permitted encrypted data locally, builds FTS5 index, searches client-side. Includes data freshness headers for conditional requests.

### Scope (4 features)

- [x] 5.1 Paginated friend data export endpoint
- [x] 5.2 Data freshness headers
- [x] 5.3 Friend search types
- [x] 5.4 Friend data E2E tests + OpenAPI

## Summary of Changes

Implemented paginated friend data export for client-side search indexing:

- **Types** (`packages/types/src/friend-export.ts`): FriendExportEntityType, FriendExportEntity, FriendExportPageResponse, FriendExportManifestEntry, FriendExportManifestResponse
- **Validation** (`packages/validation/src/friend-export.ts`): FriendExportQuerySchema (entityType, cursor, limit)
- **ETag infra** (`apps/api/src/lib/etag.ts`): computeDataEtag + checkConditionalRequest for If-None-Match/304 support
- **Export service** (`apps/api/src/services/friend-export.service.ts`): getFriendExportManifest (per-type counts + freshness) and getFriendExportPage (cursor-paginated bucket-visible entities)
- **Entity registry** (`apps/api/src/services/friend-export.constants.ts`): Per-type typed query functions for all 21 BucketContentEntityType values
- **Routes** (`apps/api/src/routes/account/friends/export.ts`): GET /:connectionId/export/manifest and GET /:connectionId/export
- **Extracted** loadBucketTags to shared bucket-access.ts
- **13 E2E tests** covering manifest, pagination, bucket filtering, conditional requests, error cases
