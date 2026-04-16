---
# crypto-j4gb
title: "Fix PR #106 review findings for bucket-keys-recovery"
status: completed
type: task
priority: high
created_at: 2026-03-14T08:04:00Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-89v7
---

Address 6 implementation fixes, 4 test additions, 1 shared helper, and 2 follow-up beans from PR #106 review.

## Summary of Changes

- Fix 1: Replace silent `?? """ fallback in `encodeBase32`with explicit`base32CharAt` that throws on out-of-range
- Fix 2: Widen try/finally in `recoverMasterKey` to cover `decodeBase32`, ensuring memzero on decode failure
- Fix 3: Add `assertAeadKey` before wrapping key casts in `encryptBucketKey` and `decryptBucketKey`
- Fix 4: Add `assertAeadKey` before recovery key casts in `generateRecoveryKey` and `recoverMasterKey`
- Fix 5: Add `validateKeyVersion(newVersion)` in `rotateBucketKey` to catch MAX_SAFE_INTEGER overflow; update `validateKeyVersion` to use `Number.isSafeInteger`; updated JSDoc
- Fix 6: Extract `ReEncryptFn` named type with semantic docs; export from index
- Fix 7: Create shared `setup-sodium.ts` test helper; refactor 3 new test files to use it
- Fix 8: KDF parameter regression test proving wrapping key uses context `bktkeywp` subkey 1
- Fix 9: Version overflow boundary test (MAX_SAFE_INTEGER rotation throws)
- Fix 10: Chained rotation test (key1 → key2 → key3 preserves data)
- Created follow-up beans: crypto-249b (branded types), crypto-o5dr (cache LRU eviction)
