---
# api-zn48
title: Add per-account session limit
status: completed
type: task
priority: normal
created_at: 2026-03-24T21:49:19Z
updated_at: 2026-03-24T22:15:32Z
parent: ps-8al7
---

No enforced limit on active sessions per account. Attacker with valid credentials can accumulate thousands of sessions. Add count check before session creation, evict oldest if limit exceeded.

**Audit ref:** Finding 7 (MEDIUM) — A04 Insecure Design / DoS
**File:** apps/api/src/services/auth.service.ts (login flow)

## Summary of Changes

Added MAX_SESSIONS_PER_ACCOUNT=50 constant. In login transaction, count active sessions before insert; evict oldest (by lastActive) if at limit.
