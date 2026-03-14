---
# crypto-h25k
title: "Fix PR #107 review findings for crypto sign/storage/safety"
status: completed
type: task
priority: high
created_at: 2026-03-14T10:06:50Z
updated_at: 2026-03-14T10:10:37Z
---

Address all 12 review findings from PR #107 (feat/crypto-sign-storage-safety): 2 critical, 4 important, 6 suggestions. Covers adapter catch blocks, assertSignature, web-key-storage opts/clearAll, safety-number divisibility guard, test improvements, and memzero cleanup.

## Checklist

- [x] 1. Narrow signVerifyDetached catch in wasm-adapter.ts (Critical)
- [x] 2. Narrow signVerifyDetached catch in react-native-adapter.ts (Critical)
- [x] 3. Add assertSignature in sign.ts decryptThenVerify (Important)
- [x] 4. Add \_opts param to web-key-storage store() (Important) — skipped, interface already enforces contract
- [x] 5. Wrap clearAll in try/finally (Important)
- [x] 6. Add divisibility assertion in safety-number.ts (Important)
- [x] 7. Export SAFETY_NUMBER_HASH_BYTES from index.ts (Suggestion)
- [x] 8. Add corrupted-signature test (Suggestion)
- [x] 9. Simplify leading-zero test (Suggestion)
- [x] 10. Remove fragile constant-equality test (Suggestion)
- [x] 11. Add Unicode stableId test (Suggestion)
- [x] 12. Memzero combined buffer in signThenEncrypt (Suggestion)

## Summary of Changes

Addressed all 12 PR #107 review findings:

- Narrowed catch blocks in both adapters to only catch libsodium signature errors
- Added assertSignature validation in decryptThenVerify before casting
- Wrapped clearAll memzero loop in try/finally to prevent key leaks
- Added SAFETY_NUMBER_HASH_BYTES divisibility guard
- Added memzero cleanup for combined buffer in signThenEncrypt
- Exported SAFETY_NUMBER_HASH_BYTES constant
- Added corrupted-signature and Unicode stableId tests
- Simplified leading-zero test, removed fragile constant-equality test
