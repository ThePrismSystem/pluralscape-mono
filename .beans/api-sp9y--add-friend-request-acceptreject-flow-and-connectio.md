---
# api-sp9y
title: Add friend request accept/reject flow and connection status filter
status: completed
type: feature
priority: critical
created_at: 2026-03-29T21:31:09Z
updated_at: 2026-03-30T00:15:25Z
parent: api-e7gt
---

Friend code redemption currently goes directly to 'accepted' status, bypassing any pending state. Requirements specify distinct accept/reject actions. Additionally, list friends endpoint only has includeArchived boolean — no status filter for pending/active/blocked/archived.

Audit ref: Domain 10, gaps 1-2

## Summary of Changes

- Added `acceptFriendConnection()` and `rejectFriendConnection()` to friend-connection.service.ts
- Changed friend code redemption from 'accepted' to 'pending' status (2 locations)
- Added `status` filter to `ListFriendConnectionOpts` and list endpoint
- Created accept.ts and reject.ts route handlers
- Added audit events: friend-connection.accepted, friend-connection.rejected
- 6 unit tests for accept/reject routes
