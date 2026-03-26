---
# api-dgng
title: Acknowledgement lifecycle events
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:11:34Z
parent: api-vjmu
blocked_by:
  - api-5wmv
---

Register acknowledgement.created/confirmed/archived/deleted event types. Tests: unit (event type validation) + integration (lifecycle event persistence).

## Summary of Changes\n\nAdded 5 acknowledgement audit event types to `AuditEventType` union: created, confirmed, archived, restored, deleted. Updated exhaustive switch in type test.
