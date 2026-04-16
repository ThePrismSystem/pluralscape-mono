---
# crypto-umds
title: Fix EncryptedBlob codec review issues
status: completed
type: bug
priority: normal
created_at: 2026-03-11T07:37:54Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-89v7
---

Address 1 critical, 6 important, and 7 suggestion-level issues found during multi-model PR review of encrypted blob codec

## Summary of Changes

- Added serialize-side validation: tier, nonce length, keyVersion sentinel collision guard, bucketId max length
- Added hasBucketId flag validation on deserialize
- Fixed toString radix bug (was using HEX_PAD_WIDTH=2 as radix instead of 16)
- Updated wire format doc comment to document 0xFFFFFFFF reserved sentinel
- Merged duplicate import type statements
- Simplified hasBucketId double-guard by removing redundant boolean variable
- Used view-over-buffer instead of copy in both PG and SQLite encryptedBlobFromDriver
- Added serialize error tests, hasBucketId flag test, subarray offset test, version hex format test
- Added T2 blob round-trip tests in column tests and integration tests
- Added testBlobT2 helper in both PG and SQLite test helpers
