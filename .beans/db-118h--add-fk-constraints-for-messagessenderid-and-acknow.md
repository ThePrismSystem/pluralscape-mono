---
# db-118h
title: Add FK constraints for messages.senderId and acknowledgements.targetMemberId
status: todo
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

Both are bare varchar with no FK reference. If a member is cascade-deleted, sender/target attribution is silently orphaned. Consider SET NULL on delete. Ref: audit H16
