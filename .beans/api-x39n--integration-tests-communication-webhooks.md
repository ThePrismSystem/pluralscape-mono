---
# api-x39n
title: "Integration tests: communication webhooks"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:49:11Z
parent: api-jjb0
blocked_by:
  - api-dtor
  - api-d0py
---

Test dispatcher fires for each communication event type. Test delivery worker processes communication events. PGlite + real webhook infrastructure.

## Summary of Changes\n\nWired `dispatchWebhookEvent` into all 7 communication services (channel, message, board-message, note, poll, poll-vote, acknowledgement). Total 22 dispatch calls added after audit events inside transactions. Added webhook tables (apiKeys, webhookConfigs, webhookDeliveries) to `createPgCommunicationTables` PGlite helper so dispatch calls work in integration tests.
