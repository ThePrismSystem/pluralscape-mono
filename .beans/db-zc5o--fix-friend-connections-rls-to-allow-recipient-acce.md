---
# db-zc5o
title: Fix friend_connections RLS to allow recipient access
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:48Z
updated_at: 2026-04-16T06:35:33Z
parent: ps-ai5y
---

AUDIT [DB-S-H2] RLS scoped to account_id (sender) only. Recipient cannot read incoming requests through RLS. getPendingFriendRequests() queries by friendAccountId which is gated out.

## Summary of Changes

Added `account-bidirectional` RLS scope type with per-operation policies. friend_connections now uses 4 policies: SELECT/DELETE allow both account_id and friend_account_id, INSERT/UPDATE restricted to account_id (sender). Added `accountBidirectionalRlsPolicy` generator and comprehensive PGlite integration tests verifying bidirectional read, sender-only write, and recipient delete.
