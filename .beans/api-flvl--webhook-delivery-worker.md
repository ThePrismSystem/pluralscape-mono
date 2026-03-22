---
# api-flvl
title: Webhook delivery worker
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:37Z
updated_at: 2026-03-22T12:50:45Z
parent: api-i8ln
blocked_by:
  - api-xjt6
---

BullMQ job that processes pending webhook deliveries.

## Acceptance Criteria

- [ ] BullMQ worker processes pending delivery records
- [ ] HTTP POST to webhook URL with JSON payload + HMAC signature header (`X-Pluralscape-Signature`)
- [ ] HMAC computed from webhook config's `secret` over the payload body
- [ ] Success (2xx): set status=`success`, `http_status`, `last_attempt_at`
- [ ] Failure (non-2xx or network error): increment `attempt_count`, set `next_retry_at` with exponential backoff
- [ ] Max retry attempts (configurable, default 5): set status=`failed` after exhaustion
- [ ] Terminal delivery cleanup job: purge `success`/`failed` records older than 30 days
- [ ] Integration tests with mock HTTP server
