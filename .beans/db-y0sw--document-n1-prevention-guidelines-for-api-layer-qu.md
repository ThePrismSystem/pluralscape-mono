---
# db-y0sw
title: Document N+1 prevention guidelines for API layer queries
status: scrapped
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T11:40:30Z
parent: db-hcgk
---

## Reasons for Scrapping\n\nN+1 prevention is an API-layer concern, not a schema concern. Schema already supports efficient batch loading via appropriate indexes. Deferred to M2 milestone when the API layer is built — no schema changes needed.
