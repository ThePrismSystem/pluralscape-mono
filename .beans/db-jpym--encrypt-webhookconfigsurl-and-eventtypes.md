---
# db-jpym
title: Encrypt webhookConfigs.url and eventTypes
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:28:12Z
parent: db-2nr7
---

Webhook URL may contain tokens or system identifiers. eventTypes reveals subscription patterns. Ref: audit M12

## Summary of Changes

Documented `url` and `eventTypes` as T3 with rationale in the tier map. The server must read `url` to deliver webhooks and `eventTypes` to route events. No schema changes needed — the existing `secret` field (binary) is already T1.
