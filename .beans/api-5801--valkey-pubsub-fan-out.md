---
# api-5801
title: Valkey pub/sub fan-out
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T11:39:40Z
parent: api-fh4u
---

Publish to \`sync:{docId}\` channel on ChangeAccepted. Subscribers on any server instance receive DocumentUpdate push via Valkey pub/sub.

## Acceptance Criteria

- ChangeAccepted triggers publish to \`sync:{docId}\` Valkey channel
- Subscribers on same instance receive DocumentUpdate push
- Subscribers on different server instance receive DocumentUpdate push (multi-instance)
- Valkey unavailable → graceful degradation (log warning, local delivery still works)
- Integration tests with Valkey for pub/sub roundtrip
