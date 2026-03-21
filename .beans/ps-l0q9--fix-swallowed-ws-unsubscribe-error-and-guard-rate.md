---
# ps-l0q9
title: Fix swallowed WS unsubscribe error and guard rate-limit disable in production
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:04:16Z
updated_at: 2026-03-21T03:04:19Z
parent: ps-irrf
---

## Summary of Changes

Addresses two findings from the M3 comprehensive audit:

**Q-M6 (ws-network-adapter.ts)**: Replaced silently swallowed `.catch(() => {})` on unsubscribe send with a logged warning including the document ID and error message. The logger was already available via the constructor-injected `logger` parameter.

**Sec-M4 (env.ts)**: Added a production safety guard in the `DISABLE_RATE_LIMIT` Zod transform. If `DISABLE_RATE_LIMIT=1` and `NODE_ENV=production`, the value is forced to `false` and a critical warning is written to stderr. This provides defense-in-depth alongside the existing startup throw in `index.ts`.

Tests added for both changes.
