---
# api-jic7
title: Low-priority audit gaps from feature completeness audit round 2
status: completed
type: task
priority: normal
created_at: 2026-03-30T06:58:15Z
updated_at: 2026-03-30T08:04:14Z
parent: api-e7gt
---

Consolidation of 7 low-severity gaps from round 2 audit:

- [x] Photo list lacks cursor pagination (returns simple array)
- [x] Entity links have no update endpoint (added PUT for sortOrder)
- [x] Entity associations have no update endpoint (wontfix: table has zero mutable fields, delete+recreate is correct)
- [x] Field value lists lack filtering (added fieldDefinitionId filter)
- [x] Fronting reports missing update and archive/restore endpoints
- [x] Fronting session list missing end-time range filter (endFrom/endUntil)
- [x] WebSocket heartbeat not explicit (added application-level ping/pong)

## Summary of Changes

All 7 gaps addressed:

- Photo list: added composite cursor pagination (sortOrder+id)
- Entity links: added PUT endpoint for sortOrder update
- Entity associations: wontfix — zero mutable fields, delete+recreate is correct
- Field values: added fieldDefinitionId filter (combined with pagination in api-y9zq)
- Fronting reports: added update/archive/restore with DB migration for lifecycle columns
- Fronting sessions: added endFrom/endUntil filters with automatic active session exclusion
- WebSocket heartbeat: added 30s ping interval with 10s pong timeout
