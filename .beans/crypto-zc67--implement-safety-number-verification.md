---
# crypto-zc67
title: Implement Safety Number verification
status: completed
type: feature
priority: high
created_at: 2026-03-09T12:13:19Z
updated_at: 2026-03-14T09:41:42Z
parent: crypto-gd8f
blocking:
  - ps-qcfr
---

Implement Safety Number verification (Ed25519 public key fingerprint comparison) for out-of-band identity verification. Without this, self-hosted instances are vulnerable to MITM by malicious admins substituting fake public keys on initial key exchange (TOFU). Must ship before any self-hostable build.

Source: Architecture Audit 004, Metric 1

## Summary of Changes

Added genericHash (BLAKE2b) to SodiumAdapter interface and both wasm/react-native implementations. Added GENERIC_HASH_BYTES_MIN/MAX, SAFETY_NUMBER_VERSION/ITERATIONS/HASH_BYTES constants. Added assertGenericHashLength to validation.ts. Implemented computeSafetyNumber() in safety-number.ts using Signal-inspired BLAKE2b fingerprinting (5200 iterations, 30 bytes per user, 12 groups of 5 digits). Order-independent via lexicographic key comparison. 23 tests passing (11 generic-hash, 12 safety-number).
