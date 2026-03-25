---
# api-dtor
title: Register communication webhook event types
status: todo
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T05:59:20Z
parent: api-jjb0
---

Add ~18 event types: channel.created/updated/archived/deleted, message.created/updated/deleted, board-message.created/updated/deleted, note.created/updated/deleted, poll.created/closed, poll-vote.cast, acknowledgement.created/confirmed. Wire into existing webhook dispatcher (apps/api/src/services/webhook-dispatcher.ts). Tests: unit (event type registration, payload shapes).
