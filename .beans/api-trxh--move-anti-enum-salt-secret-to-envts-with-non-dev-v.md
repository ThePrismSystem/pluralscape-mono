---
# api-trxh
title: Move ANTI_ENUM_SALT_SECRET to env.ts with non-dev validation
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T11:53:41Z
parent: api-v8zu
---

Finding [H2] from audit 2026-04-20. apps/api/src/routes/auth/salt.ts:43. Secret read via process.env directly; deterministic dev fallback active in staging defeats anti-enumeration protection. Fix: add to env.ts with required-in-non-development validation.

## Summary of Changes

Moved ANTI_ENUM_SALT_SECRET validation into env.ts as a Zod-schema field: optional in dev/test, required and at least 32 chars in production, with an explicit refinement rejecting the dev default. Removed the parallel boot-time check from auth.constants.ts and the stale ANTI_ENUM_SALT_SECRET_ENV constant. salt.ts now reads env.ANTI_ENUM_SALT_SECRET. Added env-anti-enum-secret.test.ts covering all four refinement branches plus the dev fallback.
