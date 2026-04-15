---
# db-vguh
title: Fix SQLite getCurrentFrontingComments join missing systemId
status: completed
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-14T14:53:47Z
parent: ps-4ioj
---

SQLite getCurrentFrontingComments joins only on frontingSessionId without systemId, weaker than the PG equivalent.

## Summary of Changes\n\nAdded systemId condition to SQLite getCurrentFrontingComments inner join, matching PG's defense-in-depth approach. SQLite uses 2-condition join (no sessionStartTime column).
