---
# db-u7wd
title: Add composite unique constraints to membership tables
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:50:07Z
parent: db-gt84
---

subsystem_memberships, side_system_memberships, layer_memberships all enforce uniqueness at app layer only. Add DB-level unique constraints. Ref: audit M8

## Summary of Changes

No code changes needed. Membership tables store `memberId` inside `encryptedData`, making DB-level composite uniqueness impossible. This is by design (ZK contract). Existing code comments document this limitation.
