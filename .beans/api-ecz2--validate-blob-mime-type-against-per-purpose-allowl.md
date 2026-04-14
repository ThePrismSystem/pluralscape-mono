---
# api-ecz2
title: Validate blob MIME type against per-purpose allowlist
status: completed
type: bug
priority: critical
created_at: 2026-04-14T09:28:24Z
updated_at: 2026-04-14T10:24:25Z
---

AUDIT [API-S-C1] mimeType accepts any string up to 255 chars. Clients can declare text/html or application/javascript, creating stored XSS/content-injection risk. File: packages/validation/src/blob.ts:22, apps/api/src/services/blob.service.ts:84. Fix: Validate mimeType in CreateUploadUrlBodySchema against per-purpose allowlist.

## Summary of Changes

Added per-purpose MIME type allowlists to CreateUploadUrlBodySchema via superRefine validation. Each BlobPurpose maps to a strict set of allowed MIME types (e.g., avatars only accept image/png, image/jpeg, image/webp). Rejects dangerous types like text/html and application/javascript that could enable stored XSS. Exported ALLOWED_MIME_TYPES constant for reuse. Added comprehensive test coverage for all purpose/MIME combinations.
