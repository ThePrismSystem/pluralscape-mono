---
# api-sp9y
title: Add friend request accept/reject flow and connection status filter
status: todo
type: feature
priority: critical
created_at: 2026-03-29T21:31:09Z
updated_at: 2026-03-29T21:31:09Z
parent: api-e7gt
---

Friend code redemption currently goes directly to 'accepted' status, bypassing any pending state. Requirements specify distinct accept/reject actions. Additionally, list friends endpoint only has includeArchived boolean — no status filter for pending/active/blocked/archived.

Audit ref: Domain 10, gaps 1-2
