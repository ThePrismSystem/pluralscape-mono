---
# api-smlf
title: Wire friend webhook events (4 events)
status: done
type: task
priority: normal
created_at: 2026-03-29T02:08:00Z
updated_at: 2026-03-29T03:03:50Z
parent: api-9wze
blocked_by:
  - api-q642
---

Add dispatch for friend.connected/removed/bucket-assigned/bucket-unassigned. Separate from identity events because friend connections use account-scoped transactions while dispatch requires a SystemId. Bucket-assignment events have systemId available; connection events need a design decision (dispatch to all systems owned by the account, or require system context from caller).

## Summary of Changes

Wired dispatchWebhookEvent calls into 3 service files for 4 friend events:

- friend-code.service: friend.connected on redeem, dispatched to all ownedSystemIds of the redeemer
- friend-connection.service: friend.removed on block/remove, dispatched to all ownedSystemIds of the acting account
- bucket-assignment.service: friend.bucket-assigned on assign, friend.bucket-unassigned on unassign (system-scoped, straightforward)

Design decision for account-scoped events: dispatch to all systems owned by the acting account (auth.ownedSystemIds). The other party's systems receive events when bucket operations occur on their systems.
