---
# api-xjt6
title: Webhook event dispatcher
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:31Z
updated_at: 2026-03-22T12:50:44Z
parent: api-i8ln
blocked_by:
  - api-a40k
---

Internal event bus that creates delivery records when system events occur.

## Acceptance Criteria

- [ ] Event emitter integration — hooks into existing service operations (member create/update, fronting start/end, etc.)
- [ ] On event: queries enabled webhook configs matching the event type
- [ ] Creates `webhook_deliveries` record per matching config with status `pending`
- [ ] Payload construction: plaintext (T3 metadata) by default; encrypted (T1 ciphertext) if `crypto_key_id` is set
- [ ] Enqueues delivery job in BullMQ for async processing
- [ ] Unit tests for event matching and payload construction
