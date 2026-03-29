---
# api-smlf
title: Wire friend webhook events (4 events)
status: todo
type: task
priority: normal
created_at: 2026-03-29T02:08:00Z
updated_at: 2026-03-29T02:08:23Z
parent: api-9wze
blocked_by:
  - api-q642
---

Add dispatch for friend.connected/removed/bucket-assigned/bucket-unassigned. Separate from identity events because friend connections use account-scoped transactions while dispatch requires a SystemId. Bucket-assignment events have systemId available; connection events need a design decision (dispatch to all systems owned by the account, or require system context from caller).
