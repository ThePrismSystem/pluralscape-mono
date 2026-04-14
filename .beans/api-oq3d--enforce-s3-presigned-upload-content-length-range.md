---
# api-oq3d
title: Enforce S3 presigned upload content-length-range
status: todo
type: bug
priority: critical
created_at: 2026-04-14T09:28:28Z
updated_at: 2026-04-14T09:28:28Z
---

AUDIT [API-S-C2] PutObjectCommand signing hint is not S3-enforced. Client can upload much larger object than declared, bypassing size limit and quota. File: packages/storage/src/adapters/s3/s3-adapter.ts:196-201. Fix: Use S3 POST presigned policies with content-length-range condition.
