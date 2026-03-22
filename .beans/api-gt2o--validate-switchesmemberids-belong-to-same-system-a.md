---
# api-gt2o
title: Validate switches.memberIds belong to same system at write time
status: scrapped
type: task
priority: normal
created_at: 2026-03-12T21:24:26Z
updated_at: 2026-03-21T22:32:13Z
parent: api-0zl4
---

App-layer validation: when writing a switch record, verify all memberIds in the array belong to the same system as the switch. This is a business-logic constraint, not a schema concern. Reclassified from db-19ae.

## Deferred\n\nBlocked on fronting route implementation — no switch routes/services exist yet. Will implement alongside M4 fronting feature work.

## Reasons for Scrapping\n\nScoped out of M4 tech debt epic by user decision.
