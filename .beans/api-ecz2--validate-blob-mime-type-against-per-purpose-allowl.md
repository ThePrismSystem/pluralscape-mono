---
# api-ecz2
title: Validate blob MIME type against per-purpose allowlist
status: todo
type: bug
priority: critical
created_at: 2026-04-14T09:28:24Z
updated_at: 2026-04-14T09:28:24Z
---

AUDIT [API-S-C1] mimeType accepts any string up to 255 chars. Clients can declare text/html or application/javascript, creating stored XSS/content-injection risk. File: packages/validation/src/blob.ts:22, apps/api/src/services/blob.service.ts:84. Fix: Validate mimeType in CreateUploadUrlBodySchema against per-purpose allowlist.
