---
# api-dwou
title: Lifecycle event type-specific validation
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-18T07:57:07Z
parent: api-00hp
blocked_by:
  - api-hs95
  - api-puib
  - api-utms
---

Zod schemas + service-layer validation for all 13 event types: split (source->results), fusion (sources->result), dormancy (relatedEventId linking), structure-move (validates from/to structure entities), innerworld-move (validates entity/region IDs). Extracted from route handler.

## Audit Note (B-1)\n\nPlaintext metadata column added to lifecycle_events table. Per-event-type validation implemented via discriminated Zod schemas in the validation package. The original plan for per-event-type schemas on encrypted data was replaced with plaintext reference fields (api-qwrq Option B).
