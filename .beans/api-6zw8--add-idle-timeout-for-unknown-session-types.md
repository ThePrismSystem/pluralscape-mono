---
# api-6zw8
title: Add idle timeout for unknown session types
status: todo
type: bug
priority: low
created_at: 2026-03-30T22:35:49Z
updated_at: 2026-03-30T22:35:49Z
---

Security audit finding: session-auth.ts getIdleTimeout() returns null for unrecognized session types, bypassing idle enforcement. Add a default idle timeout fallback for unmapped session configs.
