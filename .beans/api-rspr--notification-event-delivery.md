---
# api-rspr
title: Notification event delivery
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: api-n8wk
---

Subscribe to Valkey notification channels for the authenticated account. Push events as SSE data lines (JSON). Event types: fronting status change, system notification, acknowledgement signal.

## Acceptance Criteria

- Valkey event on account's channel → delivered as SSE \`data:\` line with JSON payload
- Event type included in SSE \`event:\` field for client-side filtering
- All connected SSE clients for an account receive the event
- Events delivered in order per channel
- Integration test with Valkey: publish event, verify SSE delivery
