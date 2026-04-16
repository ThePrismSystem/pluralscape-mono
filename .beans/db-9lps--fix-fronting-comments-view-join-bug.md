---
# db-9lps
title: Fix fronting comments view join bug
status: completed
type: bug
priority: normal
created_at: 2026-03-13T13:30:06Z
updated_at: 2026-04-16T07:29:37Z
parent: ps-vtws
---

getCurrentFrontingComments joins on frontingSessionId only but fronting_sessions has composite PK (id, startTime). Need full 3-column join: frontingSessionId + systemId + sessionStartTime.

## Summary of Changes

Fixed getCurrentFrontingComments view to join on all 3 FK columns (frontingSessionId, systemId, sessionStartTime) instead of just frontingSessionId. Prevents cross-system comment leaks through the partitioned fronting_sessions table.
