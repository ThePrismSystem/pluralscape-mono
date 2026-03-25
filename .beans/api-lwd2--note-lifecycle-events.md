---
# api-lwd2
title: Note lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T14:45:21Z
parent: api-i16z
blocked_by:
  - api-yirj
---

Register note.created/updated/archived/restored/deleted event types. Tests: unit (event type validation) + integration (lifecycle event persistence).

## Summary of Changes

All note lifecycle events already registered in prerequisite step:

- `note.created`, `note.updated`, `note.archived`, `note.restored`, `note.deleted` in AuditEventType and AUDIT_EVENT_TYPES
- Webhook events `note.created`, `note.updated` already existed
- Service calls audit() for every mutation
