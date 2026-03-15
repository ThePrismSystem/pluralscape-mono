---
# crypto-75tg
title: "Fix PR #116 review issues (17 fixes)"
status: completed
type: task
priority: normal
created_at: 2026-03-15T08:10:04Z
updated_at: 2026-03-15T08:16:51Z
---

Address 3 critical bugs, 4 important issues, and 10 suggestions from PR #116 review

## Summary of Changes

### Critical Fixes

- **Fix 1**: `pgGetActiveRecoveryKey`/`sqliteGetActiveRecoveryKey` WHERE clause now filters `revokedAt IS NULL` in SQL instead of JS post-filter
- **Fix 2**: `fromHex()` validates input (odd-length, non-hex chars) and throws `InvalidInputError`
- **Fix 3**: `decodeQRPayload` validates salt length via `assertPwhashSalt`; `DecodedQRPayload.salt` typed as `PwhashSalt`

### Important Fixes

- **Fix 4**: Extracted `ProfileParams`/`PROFILE_PARAMS` from `master-key.ts`, removed duplication in `master-key-wrap.ts` and `device-transfer.ts`
- **Fix 5**: Added `assertAeadKey()` validation before all `as AeadKey` casts in `master-key-wrap.ts` and `device-transfer.ts`
- **Fix 7**: Added JSDoc to `encodeQRPayload` documenting security decision re: code in QR
- **Fix 8**: `pgRevokeRecoveryKey`/`sqliteRevokeRecoveryKey` and replace variants now throw on nonexistent IDs

### Suggestions

- **Fix 6**: `assertAeadKey`/`assertPwhashSalt` now have `asserts` return types; removed all redundant `as AeadKey` casts across codebase
- **Fix 11**: Replaced `crypto.randomUUID()` with sodium-based UUID v4 for React Native compatibility
- **Fix 12**: Transfer code generation uses rejection sampling to eliminate modulo bias
- **Fix 13**: Extracted `isQRPayloadShape` type guard to simplify `decodeQRPayload`
- **Fix 14**: Added memzero tests for `deriveTransferKey`, `encryptForTransfer`, `decryptFromTransfer`
- **Fix 15**: `deserializeRecoveryBackup` minimum blob size tightened to nonce + AEAD tag (40 bytes)
- **Fix 16**: Added server profile test for `derivePasswordKey`
- **Fix 17**: Added tampered backup test for `resetPasswordViaRecoveryKey`
