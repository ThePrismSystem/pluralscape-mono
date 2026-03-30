---
# api-ejf9
title: Add device token update and delete endpoints
status: completed
type: task
priority: high
created_at: 2026-03-29T21:31:42Z
updated_at: 2026-03-30T00:38:29Z
parent: api-e7gt
---

Device tokens only have register (POST) and revoke (POST). Missing PUT/PATCH for updates and DELETE for removal.

Audit ref: Domain 15, gap 1

## Summary of Changes\n\n- Added updateDeviceToken() and deleteDeviceToken() service functions\n- Created PUT and DELETE route handlers\n- Added UpdateDeviceTokenBodySchema\n- 8 unit tests
