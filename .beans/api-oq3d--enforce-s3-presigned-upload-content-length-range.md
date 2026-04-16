---
# api-oq3d
title: Enforce S3 presigned upload content-length-range
status: completed
type: bug
priority: critical
created_at: 2026-04-14T09:28:28Z
updated_at: 2026-04-16T06:35:32Z
parent: ps-ai5y
---

AUDIT [API-S-C2] PutObjectCommand signing hint is not S3-enforced. Client can upload much larger object than declared, bypassing size limit and quota. File: packages/storage/src/adapters/s3/s3-adapter.ts:196-201. Fix: Use S3 POST presigned policies with content-length-range condition.

## Summary of Changes

Switched S3 presigned upload from PutObject signing to POST policy via createPresignedPost with content-length-range condition. S3 now server-side enforces the declared file size, preventing quota bypass by uploading larger objects than declared. Updated PresignedUrlResult interface to include optional fields for POST-based uploads. Updated blob service to pass fields through to clients. Updated mobile upload hook to use POST with FormData when fields are present, with PUT fallback for non-S3 backends.
