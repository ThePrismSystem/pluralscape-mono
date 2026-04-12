---
# db-40md
title: Audit and fix privacy bucket encrypted fields end-to-end
status: todo
type: bug
priority: critical
created_at: 2026-04-12T07:51:43Z
updated_at: 2026-04-12T07:51:43Z
parent: ps-h2gl
---

Privacy buckets use encryptedData in the Create/Update API schemas but the @pluralscape/data transforms (narrowPrivacyBucket) don't decrypt — they read name/description directly from the wire type. Either the API is returning decrypted fields alongside the blob (which the transform then ignores), or the transform is wrong. Audit the full pipeline: DB schema → API response → data transform → mobile rendering. Fix so the encrypt/decrypt cycle is consistent with all other entity types.
