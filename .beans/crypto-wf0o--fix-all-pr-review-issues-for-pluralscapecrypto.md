---
# crypto-wf0o
title: Fix all PR review issues for @pluralscape/crypto
status: completed
type: task
priority: high
created_at: 2026-03-09T22:33:09Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-89v7
---

Fix 2 critical (memory safety: key material not zeroed on error paths), 6 important (error handling, adapter fixes), and 6 suggestion-level issues from PR review of feat/crypto-foundation.

## Summary of Changes

### Phase 0: InvalidInputError constructor

- Added constructor with default message and ErrorOptions support

### Phase 1: CRITICAL — Memory Safety

- master-key.ts: Empty password guard, try/finally for passwordBytes zeroing
- identity.ts: try/finally in generateIdentityKeypair, encryptPrivateKey, decryptPrivateKey
- Added server profile comment explaining parameter choices

### Phase 2: IMPORTANT — Error Handling

- symmetric.ts: decryptJSON wraps SyntaxError in DecryptionFailedError with cause
- symmetric.ts: decryptStream catch preserves cause chain
- symmetric.ts: totalLength validation after concatenation
- Both adapters: signVerifyDetached rethrows non-Error exceptions

### Phase 3: Suggestions

- symmetric.ts: chunkSize <= 0 guard (InvalidInputError)
- symmetric.ts: Defensive DataView with byteOffset/byteLength
- Added ~20 new test cases across all test files

### Verification

- 237 tests pass (17 test files)
- Zero type errors, zero lint warnings
