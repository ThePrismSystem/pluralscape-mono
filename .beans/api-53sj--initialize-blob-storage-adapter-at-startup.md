---
# api-53sj
title: Initialize blob storage adapter at startup
status: completed
type: bug
priority: critical
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

getStorageAdapter() requires initStorageAdapter() at startup, but no call site exists. All blob routes throw at runtime. Add initialization in index.ts start() function. Ref: audit S-1.

## Summary of Changes\n\nInitialized blob storage adapter in `start()` after `initSodium()`. Uses `S3BlobStorageAdapter` when `BLOB_STORAGE_S3_BUCKET` is set, otherwise falls back to `FilesystemBlobStorageAdapter` with configurable `BLOB_STORAGE_PATH` (default: `./data/blobs`).
