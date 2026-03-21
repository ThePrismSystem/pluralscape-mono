---
# ps-rzhh
title: "Device transfer: expired records retain encrypted key material until cleanup job"
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T07:55:18Z
parent: ps-i3xl
---

Consider shorter TTL or eager wipe for expired device transfer records

## Summary of Changes\n\nAdded inline comment to device-transfer.service.ts explaining that expired transfer records retain encrypted key material until filtered by the expiresAt WHERE clause, with periodic cleanup as a future optimization.
