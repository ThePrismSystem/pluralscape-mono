---
# api-6ft8
title: Acknowledgement API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:34:23Z
parent: api-vjmu
blocked_by:
  - api-90im
  - api-5wmv
---

apps/api/src/routes/acknowledgements/ — GET/POST /v1/systems/:systemId/acknowledgements, GET/DELETE .../acknowledgements/:ackId, POST .../acknowledgements/:ackId/confirm, GET .../acknowledgements/pending (list unconfirmed for current member). Tests: unit (route validation, auth checks).

## Summary of Changes\n\nCreated 8 route files in `apps/api/src/routes/acknowledgements/`: create (201), get, list (with confirmed/includeArchived query params), confirm (200, with body), archive (204), restore (200), delete (204), and index router. Registered at `/:systemId/acknowledgements` in systems router.
