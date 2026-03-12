---
# db-118h
title: Add FK constraints for messages.senderId and acknowledgements.targetMemberId
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:50:03Z
parent: db-gt84
---

Both are bare varchar with no FK reference. If a member is cascade-deleted, sender/target attribution is silently orphaned. Consider SET NULL on delete. Ref: audit H16

## Summary of Changes

No code changes needed. The columns this bean targeted (`messages.senderId` and `acknowledgements.targetMemberId`) were removed as part of ZK contract hardening (commit 25a75d6). `acknowledgements.createdByMemberId` FK was added via db-evu5.
