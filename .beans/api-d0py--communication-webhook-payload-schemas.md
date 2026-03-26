---
# api-d0py
title: Communication webhook payload schemas
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:41:31Z
parent: api-jjb0
blocked_by:
  - api-dtor
---

Define T3 (plaintext metadata) payload shapes for each communication event type. Zero-knowledge compliant: payloads contain IDs and metadata only, never encrypted content. Tests: unit (schema validation for each payload).

## Summary of Changes\n\nReplaced generic Record<string, unknown> WebhookEventPayloadMap with typed per-event interfaces. Each event has a specific payload shape (channelId, messageId, etc. + systemId). Updated dispatchWebhookEvent to use generic K extends WebhookEventType for type-safe dispatch.
