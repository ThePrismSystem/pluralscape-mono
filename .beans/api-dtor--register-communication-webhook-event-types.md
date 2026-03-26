---
# api-dtor
title: Register communication webhook event types
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:41:31Z
parent: api-jjb0
blocked_by:
  - api-oeeq
  - api-lmdm
  - api-lwd2
  - api-iqao
  - api-dgng
---

Add ~18 event types: channel.created/updated/archived/deleted, message.created/updated/deleted, board-message.created/updated/deleted, note.created/updated/deleted, poll.created/closed, poll-vote.cast, acknowledgement.created/confirmed. Wire into existing webhook dispatcher (apps/api/src/services/webhook-dispatcher.ts). Tests: unit (event type registration, payload shapes).

## Summary of Changes\n\nRemoved 2 deprecated event types (chat.message-sent, acknowledgement.requested). Added 32 new communication event types to WebhookEventType union. Updated WEBHOOK_EVENT_TYPE_VALUES, WEBHOOK_EVENT_TYPES, DB CHECK constraints, SQLite DDL helpers, and exhaustive type tests. Bumped MAX_WEBHOOK_EVENT_TYPES from 15 to 50.
