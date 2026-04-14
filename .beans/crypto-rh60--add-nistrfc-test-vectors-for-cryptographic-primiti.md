---
# crypto-rh60
title: Add NIST/RFC test vectors for cryptographic primitives
status: completed
type: task
priority: high
created_at: 2026-04-14T09:28:57Z
updated_at: 2026-04-14T09:28:57Z
---

AUDIT [CRYPTO-TC-H1] No test vectors for XChaCha20-Poly1305, BLAKE2b, Argon2id, X25519, Ed25519. All tests are round-trip only. Algorithm substitution or parameter error would not be caught.

## Summary of Changes

Added test-vectors.test.ts with known-answer tests from RFC/NIST standards for all cryptographic primitives: X25519 (RFC 7748), Ed25519 (RFC 8032), BLAKE2b (RFC 7693), XChaCha20-Poly1305 (draft-irtf-cfrg-xchacha-03), and Argon2id (pinned from project INTERACTIVE params). 23 tests total.
