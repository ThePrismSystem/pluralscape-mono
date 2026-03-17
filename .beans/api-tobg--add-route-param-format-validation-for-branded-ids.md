---
# api-tobg
title: Add route param format validation for branded IDs
status: completed
type: task
priority: low
created_at: 2026-03-17T04:00:50Z
updated_at: 2026-03-17T05:36:04Z
parent: api-o89k
---

System routes cast c.req.param('id') as SystemId without validation. Add format guards (e.g., starts with sys\_, correct length) at the route level for better error messages and defense in depth.

## Summary of Changes\n\nAdded parseIdParam() in lib/id-param.ts with UUID v4 validation. Applied to GET/PUT/DELETE /systems/:id routes. Added 8 unit tests for parseIdParam and 3 route-level 400 tests. Updated existing route tests to use valid UUID-format IDs.
