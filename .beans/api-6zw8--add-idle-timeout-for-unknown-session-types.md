---
# api-6zw8
title: Add idle timeout for unknown session types
status: completed
type: bug
priority: low
created_at: 2026-03-30T22:35:49Z
updated_at: 2026-03-31T07:31:40Z
parent: api-e7gt
---

Security audit finding: session-auth.ts getIdleTimeout() returns null for unrecognized session types, bypassing idle enforcement. Add a default idle timeout fallback for unmapped session configs.

## Summary of Changes\n\nChanged getIdleTimeout() to return SESSION_TIMEOUTS.web.idleTimeoutMs (7 days) as fail-closed default for unrecognized session types instead of null. Added unit test for the new default and a validateSession test verifying idle expiry for unknown TTLs.
