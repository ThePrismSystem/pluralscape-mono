---
# crypto-6j6d
title: "Fix PR #105 review findings for encryption tier helpers"
status: completed
type: bug
priority: normal
created_at: 2026-03-14T06:31:00Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-gd8f
---

Address 4 issues from multi-model review: encryptJSON input validation, nonce validation in blobToPayload, keyVersion validation in encryptTier2, deriveDataKey adapter threading. Plus JSDoc and 17 new tests.

## Summary of Changes

- **encryptJSON**: Reject non-JSON-serializable inputs (undefined, functions, symbols) with InvalidInputError
- **blobToPayload**: Validate nonce length with assertAeadNonce before unsafe cast
- **encryptTier2**: Validate keyVersion (reject negative, fractional, NaN) with validateKeyVersion helper
- **deriveDataKey**: Accept SodiumAdapter parameter to eliminate redundant getSodium() calls
- **JSDoc**: Document bucket key zeroing responsibility on Tier2EncryptParams and T2 functions
- **Tests**: 17 new tests (14 tiers, 3 symmetric) covering all new validation paths
