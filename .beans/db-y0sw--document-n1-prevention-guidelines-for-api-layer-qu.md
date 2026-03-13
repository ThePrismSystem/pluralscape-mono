---
# db-y0sw
title: Document N+1 prevention guidelines for API layer queries
status: completed
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T06:40:12Z
parent: db-hcgk
---

N+1 prevention is an API-layer concern, not a schema concern. Schema already supports efficient batch loading via appropriate indexes. Documented as an API-layer guideline to be enforced when the API layer is built (M2 milestone). No schema changes needed.
