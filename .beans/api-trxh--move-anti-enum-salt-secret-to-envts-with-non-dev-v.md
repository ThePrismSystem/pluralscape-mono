---
# api-trxh
title: Move ANTI_ENUM_SALT_SECRET to env.ts with non-dev validation
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [H2] from audit 2026-04-20. apps/api/src/routes/auth/salt.ts:43. Secret read via process.env directly; deterministic dev fallback active in staging defeats anti-enumeration protection. Fix: add to env.ts with required-in-non-development validation.
