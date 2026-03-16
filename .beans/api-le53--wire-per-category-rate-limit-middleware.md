---
# api-le53
title: Wire per-category rate limit middleware
status: todo
type: task
created_at: 2026-03-16T09:05:26Z
updated_at: 2026-03-16T09:05:26Z
blocked_by:
  - api-g954
---

Apply per-category rate limits from RATE_LIMITS constants to specific route groups (auth, write, blob, export, import, purge, friend-code, public-api, webhook, device-transfer). Currently only the global rate limit is applied. Import limits from @pluralscape/types. Per docs/planning/api-specification.md Section 1.

The middleware should also emit standard rate limit response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (Unix epoch seconds) on every response, as defined in the API specification.
