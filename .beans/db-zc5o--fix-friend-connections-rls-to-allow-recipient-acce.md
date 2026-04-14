---
# db-zc5o
title: Fix friend_connections RLS to allow recipient access
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:28:48Z
updated_at: 2026-04-14T09:28:48Z
---

AUDIT [DB-S-H2] RLS scoped to account_id (sender) only. Recipient cannot read incoming requests through RLS. getPendingFriendRequests() queries by friendAccountId which is gated out.
