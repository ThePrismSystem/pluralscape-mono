---
# api-vnec
title: Consolidate blob validation into single module
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:57:52Z
parent: api-i2pw
---

Three implementations of encrypted blob validation: encrypted-blob.ts, validate-encrypted-blob.ts, and inline in member.service.ts. Also duplicate encryptedBlobToBase64 in crypto-helpers.ts and encrypted-blob.ts. Consolidate into encrypted-blob.ts, remove duplicates. Ref: audit P-7, P-8.

## Summary of Changes

- Added `validateEncryptedBlob(base64, maxBytes?)` to `lib/encrypted-blob.ts`
- Removed inline `parseAndValidateBlob` from `member.service.ts`, now uses `validateEncryptedBlob`
- Updated 4 services importing from `crypto-helpers.ts` to import from `encrypted-blob.ts`
- Updated 3 services importing from `validate-encrypted-blob.ts` to import from `encrypted-blob.ts`
- Updated 3 test files to mock from new path
- Deleted `validate-encrypted-blob.ts` and `crypto-helpers.ts`
