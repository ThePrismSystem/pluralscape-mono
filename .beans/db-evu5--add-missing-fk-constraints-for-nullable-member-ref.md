---
# db-evu5
title: Add missing FK constraints for nullable member references
status: todo
type: bug
priority: normal
created_at: 2026-03-11T11:43:59Z
updated_at: 2026-03-11T11:43:59Z
parent: db-2je4
---

Several nullable member reference columns lack any FK constraint, allowing orphaned or cross-tenant member IDs. Columns: fieldValues.memberId (fixed in db-xnaf), messages.senderId, acknowledgements.createdByMemberId, acknowledgements.targetMemberId, relationships.sourceMemberId, relationships.targetMemberId, polls.createdByMemberId. Each needs at minimum a simple SET NULL FK to members.id.
