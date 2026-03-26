---
# api-xd5j
title: "E2E tests: communication webhooks"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T05:04:21Z
parent: api-jjb0
blocked_by:
  - api-dtor
  - api-d0py
---

apps/api-e2e/src/tests/webhooks/communication-webhooks.spec.ts — Register webhook, trigger communication events (message create, poll close, etc.), verify delivery with correct payload shapes.

## Summary of Changes\n\nCreated E2E test at `apps/api-e2e/src/tests/webhooks/communication-webhooks.spec.ts` with 4 tests: channel.created triggers delivery, poll.created triggers delivery, acknowledgement.created triggers delivery, and unsubscribed event does NOT trigger delivery. All verify webhook delivery records are created with correct event types and pending status.
