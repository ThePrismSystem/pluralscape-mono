---
# api-rspr
title: Notification event delivery
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:36:33Z
parent: api-n8wk
---

Subscribe to Valkey notification channels for the authenticated account. Push events as SSE data lines (JSON). Event types: fronting status change, system notification, acknowledgement signal.

## Acceptance Criteria

- Valkey event on account's channel → delivered as SSE \`data:\` line with JSON payload
- Event type included in SSE \`event:\` field for client-side filtering
- All connected SSE clients for an account receive the event
- Events delivered in order per channel
- Integration test with Valkey: publish event, verify SSE delivery

## Summary of Changes

- Subscribed to Valkey ps:notify:{accountId} channel for real-time events
- Events delivered as SSE data lines with JSON payload and event type field
- Created notification-pubsub.ts singleton with set/get pattern
