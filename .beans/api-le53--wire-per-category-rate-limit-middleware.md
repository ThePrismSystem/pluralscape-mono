---
# api-le53
title: Wire per-category rate limit middleware
status: completed
type: task
priority: normal
created_at: 2026-03-16T09:05:26Z
updated_at: 2026-03-16T12:57:48Z
parent: ps-rdqo
blocked_by:
  - api-g954
---

Apply per-category rate limits from RATE_LIMITS constants to specific route groups (auth, write, blob, export, import, purge, friend-code, public-api, webhook, device-transfer). Currently only the global rate limit is applied. Import limits from @pluralscape/types. Per docs/planning/api-specification.md Section 1.

The middleware should also emit standard rate limit response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (Unix epoch seconds) on every response, as defined in the API specification.

## Summary of Changes\n\n- Added `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on all responses\n- 429 now throws `ApiHttpError` for structured error format with `RATE_LIMITED` code\n- Added `createCategoryRateLimiter(category)` factory using `RATE_LIMITS` constants\n- Updated `index.ts` to use `createCategoryRateLimiter('global')` instead of hardcoded limits\n- Added comprehensive tests for headers, structured 429, and category factory
