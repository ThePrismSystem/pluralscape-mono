---
# api-uzyn
title: Fix email enumeration via login throttle timing
status: completed
type: bug
priority: normal
created_at: 2026-03-24T21:48:57Z
updated_at: 2026-03-24T22:01:15Z
parent: ps-8al7
---

Login throttle state differs for valid vs invalid emails. After cooldown, attacker can probe email existence by observing whether throttle persists. Store dummy throttle entries for non-existent emails.

**Audit ref:** Finding 3 (MEDIUM) — A07 Auth Failures / Spoofing
**File:** apps/api/src/middleware/stores/account-login-store.ts

## Summary of Changes

Changed fire-and-forget throttle recording to await for non-existent accounts in login flow.
