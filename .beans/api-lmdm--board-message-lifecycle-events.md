---
# api-lmdm
title: Board message lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:19:23Z
parent: api-b46w
blocked_by:
  - api-pcak
---

Register board-message.created/updated/reordered/archived/restored/deleted event types. Tests: unit (event type validation) + integration (lifecycle event persistence).

## Summary of Changes

Registered 6 board-message audit event types:

- `board-message.created`, `board-message.updated`, `board-message.reordered`
- `board-message.archived`, `board-message.restored`, `board-message.deleted`

Modified:

- `packages/types/src/audit-log.ts` — added to AuditEventType union
- `packages/db/src/helpers/enums.ts` — added to AUDIT_EVENT_TYPES array
- `packages/types/src/__tests__/audit-log.test.ts` — updated exhaustive switch
