---
# types-aqmu
title: Add Sha256Hex branded type for blob_metadata.checksum
status: completed
type: task
priority: low
created_at: 2026-03-13T11:22:16Z
updated_at: 2026-03-21T12:26:00Z
parent: api-0zl4
---

The checksum field on blob_metadata is typed as string at the TypeScript layer. A branded Sha256Hex type would complement the DB-level CHECK constraint (length = 64) and provide compile-time enforcement of the SHA-256 hex format invariant.

## Summary of Changes\n\nAdded `Sha256Hex` branded type to `packages/types/src/ids.ts` and `toSha256Hex()` runtime validator in `packages/types/src/sha256.ts`. Updated `BlobMetadata.checksum` to use `Sha256Hex`.
