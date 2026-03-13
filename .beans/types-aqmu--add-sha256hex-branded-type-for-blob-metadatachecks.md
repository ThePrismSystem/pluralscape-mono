---
# types-aqmu
title: Add Sha256Hex branded type for blob_metadata.checksum
status: todo
type: task
priority: low
created_at: 2026-03-13T11:22:16Z
updated_at: 2026-03-13T11:22:16Z
---

The checksum field on blob_metadata is typed as string at the TypeScript layer. A branded Sha256Hex type would complement the DB-level CHECK constraint (length = 64) and provide compile-time enforcement of the SHA-256 hex format invariant.
