---
# api-9cqf
title: Add biometric token single-use enforcement
status: completed
type: bug
priority: high
created_at: 2026-03-24T21:49:04Z
updated_at: 2026-03-24T22:15:31Z
parent: ps-8al7
---

Biometric tokens are never marked as used after verification — replay attacks possible. Add usedAt column, mark consumed after verify, add timing equalization to failed path.

**Audit ref:** Finding 4 (MEDIUM) — A07 Auth Failures / Spoofing
**File:** apps/api/src/services/biometric.service.ts:89-132

## Summary of Changes

Added usedAt column to biometric_tokens schema (PG + SQLite). Replaced SELECT with atomic UPDATE...RETURNING in verifyBiometric — tokens marked used on verify, replay prevented by isNull(usedAt) condition.
