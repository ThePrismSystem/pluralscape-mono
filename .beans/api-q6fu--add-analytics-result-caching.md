---
# api-q6fu
title: Add analytics result caching
status: scrapped
type: task
priority: low
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-16T06:29:46Z
parent: ps-4ioj
---

Every analytics request recomputes from raw session data. Add short-lived caching (60s TTL) keyed by systemId + dateRange hash.
