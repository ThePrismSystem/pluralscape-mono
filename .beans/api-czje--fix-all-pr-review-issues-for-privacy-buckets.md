---
# api-czje
title: Fix all PR review issues for privacy buckets
status: completed
type: task
priority: normal
created_at: 2026-03-26T21:08:53Z
updated_at: 2026-04-16T07:29:49Z
parent: api-e3hk
---

Address all 19 issues from multi-model PR review: missing DB enums, parseQuery misuse, phantom audit events, missing webhooks, dead code, unsafe casts, missing integration/E2E tests

## Summary of Changes

### Critical fixes

- Added 9 missing audit event types and 9 missing webhook event types to DB enum arrays (packages/db/src/helpers/enums.ts)
- Added 3 new integration test files (bucket.service, bucket-content-tag.service, field-bucket-visibility.service)
- Added cross-system isolation E2E test, delete-with-dependents E2E test

### Important fixes

- Replaced parseQuery misuse with safeParse for JSON body validation in bucket-content-tag.service.ts and set.ts route
- Made audit/webhook dispatch conditional on actual insert (not on idempotent no-ops) in tagContent and setFieldBucketVisibility
- Added webhook dispatch for field-bucket-visibility.set and field-bucket-visibility.removed events
- Fixed BucketContentTagEventPayload.entityType from string to BucketContentEntityType
- Added brandedIdQueryParam validation for bucketId in SetFieldBucketVisibilityBodySchema
- Removed unsafe `as BucketId` cast in set.ts route
- Added E2E tests for OCC conflict, tag-on-archived-bucket, non-existent field/bucket visibility

### Suggestions implemented

- Added isBucketContentEntityType type guard, used in untag route
- Removed unused scope from BucketAccessCheck interface
- Removed dead listBucketsByEntity function
- Removed unused entityId from BucketContentTagQuerySchema
- Extracted shared assertBucketExists to bucket.service.ts
- Consolidated checkBucketDependents from 5 parallel queries to 1 UNION ALL query
- Fixed TOCTOU race in bucket quota check with SELECT FOR UPDATE
- Added limit-based pagination to listTagsByBucket and listFieldBucketVisibility
- Added pagination E2E test for list buckets
