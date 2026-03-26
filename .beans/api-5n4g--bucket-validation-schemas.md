---
# api-5n4g
title: Bucket validation schemas
status: todo
type: feature
created_at: 2026-03-26T16:03:05Z
updated_at: 2026-03-26T16:03:05Z
parent: api-e3hk
blocked_by:
  - api-e3hk
---

Create Zod schemas: CreateBucketBodySchema, UpdateBucketBodySchema, TagContentBodySchema, UntagContentBodySchema, BucketQuerySchema, SetFieldBucketVisibilityBodySchema. Files: packages/validation/src/privacy.ts (new), re-export from index.ts. Tests: unit tests for each schema (valid, boundary, invalid).
