---
# api-ovul
title: Add check-in record restore and lifecycle event update
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T00:38:28Z
parent: api-e7gt
---

Two missing mutation endpoints in the fronting domain:

1. Check-in records: archive route exists but no restore endpoint — Domain 8 gap 1, Domain 15 gap 2
2. Lifecycle events: no update endpoint (create + archive/delete only) — Domain 8 gap 2

Audit ref: Domains 8/15

## Summary of Changes\n\n- Added restoreCheckInRecord() with POST /:recordId/restore route\n- Added updateLifecycleEvent() with PUT /:eventId route and OCC\n- Added UpdateLifecycleEventBodySchema\n- 10 unit tests
