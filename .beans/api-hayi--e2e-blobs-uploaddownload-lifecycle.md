---
# api-hayi
title: "E2E: blobs upload/download lifecycle"
status: completed
type: task
priority: high
created_at: 2026-03-24T12:46:13Z
updated_at: 2026-03-24T12:56:59Z
parent: api-n8od
---

E2E tests for blob upload-url, confirm, get, list, download-url, delete

## Summary of Changes\n\nCreated apps/api-e2e/src/tests/blobs/crud.spec.ts with 3 tests: upload lifecycle (presigned URL, upload, confirm, metadata, download, delete), list blobs, cross-system 404.
