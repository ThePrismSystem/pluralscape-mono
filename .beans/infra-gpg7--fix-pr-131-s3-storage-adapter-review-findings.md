---
# infra-gpg7
title: "Fix PR #131 S3 storage adapter review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-16T02:51:12Z
updated_at: 2026-03-16T03:01:25Z
---

Address 18 review findings from multi-agent PR review: TOCTOU race fix, defensive throws, metadata key constants, error mapper cleanup, forcePathStyle config, delete 404 handling, UnixMillis types, presigned URL timing, test infrastructure improvements.

## Summary of Changes

### s3-error-mapper.ts

- Removed BucketAlreadyOwnedByYou (bucket-level, not blob) and ConditionalCheckFailedException (DynamoDB, not S3)
- Added PreconditionFailed → BlobAlreadyExistsError for IfNoneMatch conditional writes
- Removed redundant cast on err.name (already narrowed by instanceof)
- EntityTooLarge now uses -1 sentinel values (S3 doesn't provide sizes)

### s3-config.ts

- Added forcePathStyle optional config field

### s3-adapter.ts

- TOCTOU race fix: replaced exists() check + PutObject with IfNoneMatch: "\*" atomic conditional write
- Metadata constants: removed x-amz-meta- prefix (SDK auto-prefixes)
- Removed .replace() calls in getMetadata — constants now match keys directly
- forcePathStyle: configurable, defaults to true for custom endpoints
- delete(): added "404" to not-found check, improved comment
- UnixMillis: use named type instead of ReturnType<typeof now>
- Presigned URLs: wrapped in try/catch with mapS3Error, captured expiresAt after SDK call
- Import ordering fixed per lint rules

### s3-error-mapper.test.ts

- Removed ConditionalCheckFailedException test
- Added PreconditionFailed → BlobAlreadyExistsError test

### minio-container.ts

- MinioTestContext: converted to discriminated union type
- ensureBucket: simplified to just mc commands (HEAD check was dead code)
- cleanup JSDoc updated

### s3-adapter.integration.test.ts

- Silent skip → context.skip() for Vitest-idiomatic skip reporting
- Removed describe.runIf(true) (no-op)
- Simplified ctx guards (discriminated union makes !ctx.config redundant)
- Added maxSizeBytes enforcement tests
