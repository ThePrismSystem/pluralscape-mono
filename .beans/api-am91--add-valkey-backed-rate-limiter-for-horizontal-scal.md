---
# api-am91
title: Add Valkey-backed rate limiter for horizontal scaling
status: in-progress
type: feature
priority: deferred
created_at: 2026-03-17T04:00:56Z
updated_at: 2026-03-18T00:14:44Z
parent: api-o89k
---

Current rate limiter is in-memory (Map). Won't be effective when horizontally scaled. Switch to Valkey/Redis-backed limiter when multi-instance deployment is needed. Track as a known limitation until then.
