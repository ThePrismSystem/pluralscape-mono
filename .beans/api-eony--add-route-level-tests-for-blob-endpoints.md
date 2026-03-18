---
# api-eony
title: Add route-level tests for blob endpoints
status: completed
type: task
priority: critical
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:50Z
parent: api-i2pw
---

Blob routes (upload-url, confirm, get, download-url, delete) have zero route-level tests. Service tests exist but route-level validation, auth enforcement, and error mapping are untested. Ref: audit T-1.

## Test Files

- [ ] `apps/api/src/__tests__/routes/blobs/upload-url.test.ts` — POST /systems/:id/blobs/upload-url
  - 201 success with blob ID and presigned upload URL
  - 400 invalid body (missing/bad purpose, mimeType, sizeBytes, encryptionTier via CreateUploadUrlBodySchema)
  - 413 sizeBytes exceeds BLOB_SIZE_LIMITS[purpose]
  - 413 QuotaExceededError from service
  - 400 storage adapter doesn't support presigned URLs (VALIDATION_ERROR)
  - Auth forwarded, assertSystemOwnership called
  - Audit trail written on success
  - blobUpload rate limiter applied

- [ ] `apps/api/src/__tests__/routes/blobs/confirm.test.ts` — POST /systems/:id/blobs/:blobId/confirm
  - 200 success with confirmed blob metadata
  - 400 invalid body (missing checksum via ConfirmUploadBodySchema)
  - 404 blobId not found or not pending
  - 404 thumbnailOfBlobId references non-existent/unconfirmed blob
  - Idempotent: re-confirm returns same result without error
  - blobId param validated via parseIdParam
  - Audit trail written on first confirmation

- [ ] `apps/api/src/__tests__/routes/blobs/get.test.ts` — GET /systems/:id/blobs/:blobId
  - 200 success returns blob metadata
  - 404 blob not found / not confirmed / archived
  - blobId param validated via parseIdParam

- [ ] `apps/api/src/__tests__/routes/blobs/download-url.test.ts` — GET /systems/:id/blobs/:blobId/download-url
  - 200 success returns presigned download URL
  - 404 blob not found
  - blobId param validated via parseIdParam

- [ ] `apps/api/src/__tests__/routes/blobs/delete.test.ts` — DELETE /systems/:id/blobs/:blobId
  - 200 success (soft-delete via archiveBlob — sets archived=true, archivedAt)
  - 404 blob not found
  - Audit trail written on success
  - write rate limiter applied

## Implementation Notes

- Pattern: `__tests__/routes/custom-fronts/crud.test.ts`
- Mock: blob.service.ts (createUploadUrl, confirmUpload, getBlob, getDownloadUrl, archiveBlob), auth middleware, rate-limit middleware, system-ownership lib
- Use `app.request()` with proper method/headers/body; assert status + parsed JSON
- Use `mockRejectedValueOnce(new ApiHttpError(...))` for error paths

## Summary of Changes

Created 5 route-level test files in `apps/api/src/__tests__/routes/blobs/`:

- upload-url.test.ts (5 tests)
- confirm.test.ts (4 tests)
- get.test.ts (3 tests)
- download-url.test.ts (3 tests)
- delete.test.ts (3 tests)

All 18 tests pass.
