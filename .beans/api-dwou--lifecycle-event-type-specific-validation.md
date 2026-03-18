---
# api-dwou
title: Lifecycle event type-specific validation
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-18T05:35:25Z
parent: api-00hp
blocked_by:
    - api-hs95
    - api-puib
    - api-utms
---

Zod schemas + service-layer validation for all 13 event types: split (source->results), fusion (sources->result), dormancy (relatedEventId linking), structure-move (validates from/to structure entities), innerworld-move (validates entity/region IDs). Extracted from route handler.
