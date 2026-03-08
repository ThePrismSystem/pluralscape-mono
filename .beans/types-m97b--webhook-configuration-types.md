---
# types-m97b
title: Webhook configuration types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:32Z
updated_at: 2026-03-08T14:03:32Z
parent: types-im7i
blocked_by:
  - types-av6x
---

WebhookConfig and WebhookDelivery types for user-configurable webhooks

## Scope

- `WebhookConfig`: id (WebhookId), systemId, url (string), events (WebhookEventType[]), enabled (boolean), apiKeyId (ApiKeyId | null — optional crypto key for encrypted payloads), createdAt
- `WebhookEventType`: 'switch' | 'fronting-start' | 'fronting-end' | 'member-created' | 'member-updated' | 'message-sent' | 'note-created' | 'poll-closed'
- `WebhookDelivery`: id, webhookId, eventType, status ('pending' | 'success' | 'failed'), httpStatus (number | null), attemptCount (number), lastAttemptAt, nextRetryAt (nullable)
- `WebhookPayload`: { event: WebhookEventType, timestamp: UnixMillis, data: T3 metadata or encrypted T1/T2 blob }
- Default: T3 metadata payloads (no crypto needed to consume)
- Optional: encrypted T1/T2 payloads when crypto key assigned

## Acceptance Criteria

- [ ] WebhookConfig with URL, event subscriptions, and optional crypto key
- [ ] All webhook event types defined
- [ ] WebhookDelivery tracks retry state
- [ ] WebhookPayload distinguishes T3 vs encrypted payloads
- [ ] Unit tests for config validation (URL format, event list)

## References

- features.md section 9 (Custom webhooks)
- ADR 013 (API Authentication)
