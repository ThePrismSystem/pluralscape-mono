---
# db-40md
title: Audit and fix privacy bucket encrypted fields end-to-end
status: completed
type: bug
priority: critical
created_at: 2026-04-12T07:51:43Z
updated_at: 2026-04-12T10:25:35Z
parent: ps-h2gl
---

Privacy buckets use encryptedData in the Create/Update API schemas but the @pluralscape/data transforms (narrowPrivacyBucket) don't decrypt — they read name/description directly from the wire type. Either the API is returning decrypted fields alongside the blob (which the transform then ignores), or the transform is wrong. Audit the full pipeline: DB schema → API response → data transform → mobile rendering. Fix so the encrypt/decrypt cycle is consistent with all other entity types.

## Summary of Changes

Rewrote `@pluralscape/data` privacy bucket transforms to follow the same encrypt/decrypt pattern as all other entity types (custom-front, member, group, etc.):

- **Wire type**: `PrivacyBucketRaw` now omits plaintext `name`/`description` and carries `encryptedData` instead
- **Assertion guard**: `assertBucketEncryptedFields` validates the decrypted blob shape
- **Decrypt**: `decryptPrivacyBucket` / `decryptPrivacyBucketPage` replace orphaned `narrowPrivacyBucket` / `narrowPrivacyBucketPage`
- **Encrypt**: `encryptBucketInput` / `encryptBucketUpdate` added for write path
- **Barrel exports**: Updated `packages/data/src/index.ts` with all new functions and types
- **Tests**: Full rewrite with real encryption round-trips, assertion guard coverage, and page decryption tests

No consumers needed changes — the old `narrow*` functions were orphaned (exported but never imported).
