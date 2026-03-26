---
# api-5n4g
title: Bucket validation schemas
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:05Z
updated_at: 2026-03-26T20:11:05Z
parent: api-e3hk
---

Create Zod schemas: CreateBucketBodySchema (name: 1-100 chars required, description: optional max 500 chars), UpdateBucketBodySchema (same fields, all optional), TagContentBodySchema (entityId: required UUID, entityType: required string, tags: non-empty string array max 50 per entity), UntagContentBodySchema (same shape as tag), BucketQuerySchema (cursor: optional string, limit: 1-100 default 50), SetFieldBucketVisibilityBodySchema (fieldDefinitionId: required UUID, bucketId: required UUID). Files: packages/validation/src/privacy.ts (new), re-export from index.ts. Tests: unit tests for each schema covering valid input, boundary cases (empty name, name at exactly 100 chars, description at 500 chars, 50 tags, 51 tags, duplicate tags, limit=0, limit=101), and invalid input (missing required fields, wrong types, malformed UUIDs).

## Summary of Changes

Created packages/validation/src/privacy.ts with Zod schemas: CreateBucketBodySchema, UpdateBucketBodySchema, BucketQuerySchema, TagContentBodySchema, BucketContentTagQuerySchema, SetFieldBucketVisibilityBodySchema. Moved BUCKET_CONTENT_ENTITY_TYPES runtime array from db to types package for cross-package access. Added comprehensive unit tests.
