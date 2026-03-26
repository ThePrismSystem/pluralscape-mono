---
# api-op67
title: Add webhook config caching
status: todo
type: feature
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

Every write operation queries webhook_configs to find matching configs for dispatch. Configs change rarely but are read on every single mutation.

## Fix

Cache per-system webhook configs in Valkey with short TTL or in-memory with invalidation on webhook config CRUD operations.

## Tasks

- [ ] Add Valkey cache for webhook configs per system
- [ ] Invalidate cache on webhook config create/update/delete/archive/restore
- [ ] Add integration test for cache invalidation
