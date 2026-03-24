---
# api-thvv
title: Fix fake recovery key generation algorithm difference
status: completed
type: task
priority: low
created_at: 2026-03-24T21:48:55Z
updated_at: 2026-03-24T22:01:16Z
parent: ps-8al7
---

generateFakeRecoveryKey() uses byte-level modulo for character selection while real keys use bit-level buffer extraction. Align algorithms to prevent statistical distinguishing of real vs fake registration responses.

**Audit ref:** Finding 2 (LOW) — A02 Cryptographic Failures / Spoofing
**File:** apps/api/src/services/auth.service.ts:536-551

## Summary of Changes

Replaced modulo-based character selection with 5-bit extraction in generateFakeRecoveryKey to match real recovery key algorithm.
