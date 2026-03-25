---
# api-oeeq
title: Chat lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T07:22:57Z
parent: api-ryy0
blocked_by:
  - api-cqkh
  - api-1hv8
---

Register channel.created/updated/archived/restored/deleted and message.created/updated/archived/deleted event types. Add Zod validation schemas in lifecycle event framework. Tests: unit (event type validation) + integration (lifecycle event persistence).

## Summary of Changes\n\nAdded 10 audit event types (channel.created/updated/archived/restored/deleted and message equivalents) to AuditEventType union. Updated exhaustiveness test.
