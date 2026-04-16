---
# crypto-yef8
title: Fix all PR review issues for @pluralscape/crypto
status: completed
type: task
priority: normal
created_at: 2026-03-09T04:12:55Z
updated_at: 2026-04-16T07:29:36Z
parent: crypto-89v7
---

Address 7 important issues and 10 suggestions from multi-model PR review: race conditions, null AD coercion, bare catch blocks, bundler issues, input validation, branded types, missing tests, and more.

## Summary of Changes

Addressed 7 important issues and 10 suggestions from PR review:

**Important fixes:**

- I-1: RN adapter no longer coerces null AD to empty string
- I-2: initSodium() race condition fixed with shared promise
- I-3: DecryptionFailedError now propagates cause via ErrorOptions
- I-4: Descriptive error when RN adapter init fails without configureSodium()
- I-5: Subpath exports for adapters (./wasm, ./react-native) — removed unconditional re-exports
- I-6: supportsSecureMemzero boolean on adapter interface
- I-7: Removed false memzero declaration from RN .d.ts

**Suggestions implemented:**

- S-1: Input validation via assertBufferLength helpers (validation.ts)
- S-2: lib() throws CryptoNotReadyError instead of generic Error
- S-3: signVerifyDetached catches exceptions and returns false
- S-4: SODIUM_CONSTANTS is Object.freeze()'d
- S-5: Branded types for all crypto parameters
- S-6: SodiumConstants uses typeof SODIUM_CONSTANTS for literal types
- S-8: Shared SODIUM_CONSTANTS replaces duplicated objects in both adapters
- S-9: Added missing tests (memzero, tampered box, KDF bounds, concurrent init, etc.)
- S-10: Clarified blob entity mapping in document topology

**S-7 (signSeedKeypair param) was not applied** — TypeScript allows omitting unused trailing params.
