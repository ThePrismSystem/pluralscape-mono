---
# api-9gtw
title: Fix Valkey rate limiter wiring and category key collision
status: todo
type: bug
priority: high
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:12:32Z
parent: api-i2pw
---

All rate limiters capture sharedStore at construction time (before setRateLimitStore is called in start()). Valkey store is never used. Also, category is not included in rate limit keys so categories with the same window collide. Fix: resolve store lazily at request time, include category in key. Ref: audit S-3.
