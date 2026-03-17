---
# api-kdze
title: Add list systems endpoint (GET /systems)
status: completed
type: feature
priority: low
created_at: 2026-03-17T04:00:58Z
updated_at: 2026-03-17T05:42:51Z
parent: api-o89k
---

No endpoint to enumerate systems for an account. An account with multiple systems has no way to list them. Add GET /systems with ownership filtering and pagination.

## Summary of Changes\n\nAdded GET /systems endpoint with cursor-based pagination. New service function listSystems() queries owned non-archived systems. Route registered before /:id to avoid capture. Added systems.constants.ts pagination constants (DEFAULT_SYSTEM_LIMIT=25, MAX_SYSTEM_LIMIT=100). 6 route tests and 6 service tests added.
