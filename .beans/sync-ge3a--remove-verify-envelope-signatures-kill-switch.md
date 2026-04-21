---
# sync-ge3a
title: Remove VERIFY_ENVELOPE_SIGNATURES kill-switch
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:28:12Z
parent: sync-me6c
---

Finding [H1] from audit 2026-04-20. apps/api/src/ws/envelope-verification-config.ts:8-19. Env var disables all server-side Ed25519 signature checks on changes and snapshots. Operator misconfiguration silently allows unsigned/forged envelopes. Fix: always-on verification; remove kill-switch or gate on build-time flag for test infra only.

## Summary of Changes

Removed VERIFY_ENVELOPE_SIGNATURES kill-switch entirely. Server-side Ed25519 signature verification on sync changes and snapshots is always on. Pre-release posture permits the unconditional removal.

- Deleted apps/api/src/ws/envelope-verification-config.ts
- Deleted apps/api/src/**tests**/ws/envelope-verification.test.ts
- Removed shouldVerifyEnvelopeSignatures import and early-return in verifyEnvelopeOrError
- Updated handlers.test.ts and message-router.test.ts in both **tests** locations to mock verifyEnvelopeSignature directly instead of toggling the kill-switch
- Added top-level beforeAll(initSodium) where signature verification path is now reached
