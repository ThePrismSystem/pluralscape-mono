---
# api-rhy0
title: Fix WebhookConfigResult/WebhookDeliveryResult using number instead of UnixMillis
status: todo
type: bug
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T07:43:54Z
parent: ps-106o
---

These are the only M5 result interfaces using raw number for timestamps instead of UnixMillis.

## Files

- webhook-config.service.ts:39-41
- webhook-delivery.service.ts:36-38

## Fix

Change to UnixMillis / UnixMillis | null to match all other result types.

## Tasks

- [ ] Update WebhookConfigResult interface
- [ ] Update WebhookDeliveryResult interface
