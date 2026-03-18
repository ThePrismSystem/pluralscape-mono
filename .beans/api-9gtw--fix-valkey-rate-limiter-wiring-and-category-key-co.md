---
# api-9gtw
title: Fix Valkey rate limiter wiring and category key collision
status: completed
type: bug
priority: high
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

All rate limiters capture sharedStore at construction time (before setRateLimitStore is called in start()). Valkey store is never used. Also, category is not included in rate limit keys so categories with the same window collide. Fix: resolve store lazily at request time, include category in key. Ref: audit S-3.

## Summary of Changes\n\nFixed two bugs in rate limiter:\n1. Store resolution moved from construction-time to first-request-time (lazy), so `sharedStore` is available after `start()` sets it\n2. Added `category` option to `RateLimiterOptions`; keys now include category prefix to prevent cross-category counter collision
