---
# db-6lhh
title: Review switches table partitioning needs
status: scrapped
type: task
priority: deferred
created_at: 2026-03-13T13:30:06Z
updated_at: 2026-03-21T23:03:13Z
parent: ps-9u4w
---

Revisit after real-world usage data to determine if switches table needs time-based partitioning for high-frequency switch logging.

## Reasons for Scrapping\n\nThe switches table has been removed from the data model. Fronting is modeled exclusively through fronting_sessions.
