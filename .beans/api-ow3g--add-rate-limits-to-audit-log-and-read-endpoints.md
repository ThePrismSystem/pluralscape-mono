---
# api-ow3g
title: Add rate limits to audit log and read endpoints
status: todo
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:12:34Z
parent: api-i2pw
---

Read endpoints rely only on global 100/min rate limit. Audit log query has no specific rate limit. Add authLight to audit log, consider read category for GET endpoints. Ref: audit S-10, S-11.
