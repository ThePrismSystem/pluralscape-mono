---
# api-tobg
title: Add route param format validation for branded IDs
status: todo
type: task
priority: low
created_at: 2026-03-17T04:00:50Z
updated_at: 2026-03-17T04:00:50Z
parent: api-o89k
---

System routes cast c.req.param('id') as SystemId without validation. Add format guards (e.g., starts with sys\_, correct length) at the route level for better error messages and defense in depth.
