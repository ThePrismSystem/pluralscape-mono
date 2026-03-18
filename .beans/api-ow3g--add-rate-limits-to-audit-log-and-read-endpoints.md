---
# api-ow3g
title: Add rate limits to audit log and read endpoints
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:40:31Z
parent: api-i2pw
---

Read endpoints rely only on global 100/min rate limit. Audit log query has no specific rate limit. Add authLight to audit log, consider read category for GET endpoints. Ref: audit S-10, S-11.

## Summary of Changes\n\nAdded `createCategoryRateLimiter("authLight")` middleware to the audit log route, giving it a 20/min per-IP limit.
