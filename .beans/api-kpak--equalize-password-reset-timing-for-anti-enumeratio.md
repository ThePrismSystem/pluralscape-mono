---
# api-kpak
title: Equalize password reset timing for anti-enumeration
status: completed
type: bug
priority: low
created_at: 2026-03-24T21:49:24Z
updated_at: 2026-03-24T22:01:15Z
parent: ps-8al7
---

Password reset via recovery key has timing difference between wrong-key path (Argon2id ~500ms) and account-not-found path (sleep to 500ms). Apply equalizeAntiEnumTiming() to both paths.

**Audit ref:** Finding 9 (LOW) — A07 Auth Failures / Spoofing
**File:** apps/api/src/services/recovery-key.service.ts

## Summary of Changes

Added equalizeAntiEnumTiming to finally block in resetPasswordWithRecoveryKey crypto path.
