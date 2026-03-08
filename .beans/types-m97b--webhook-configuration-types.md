---
# types-m97b
title: Webhook configuration types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:32Z
updated_at: 2026-03-08T14:22:13Z
parent: types-im7i
blocked_by:
  - types-av6x
---

WebhookConfig and WebhookDelivery types for user-configurable webhooks.

## Scope

- `WebhookConfig`: id (WebhookId), systemId, url (string), secret (string — HMAC signing), events (WebhookEventType[]), enabled (boolean), apiKeyId (ApiKeyId | null), createdAt, updatedAt
- `WebhookEventType`: 'switch' | 'fronting-start' | 'fronting-end' | 'member-created' | 'member-updated' | 'message-sent' | 'note-created' | 'poll-closed' | 'lifecycle-event' | 'timer-check-in' | 'friend-connected' | 'friend-disconnected' | 'api-key-created' | 'api-key-revoked' | 'group-updated'
- `WebhookDelivery`: id, webhookId, eventType, status ('pending' | 'success' | 'failed'), httpStatus (number | null), attemptCount (number), lastAttemptAt, nextRetryAt (nullable)
- `WebhookDeliveryPayload`: discriminated union:
  - `PlaintextWebhookPayload`: { encrypted: false, event, timestamp, data: T3 metadata }
  - `EncryptedWebhookPayload`: { encrypted: true, event, timestamp, encryptedData: EncryptedBlob } — when crypto key assigned

## Acceptance Criteria

- [ ] WebhookConfig with secret field for HMAC signing
- [ ] WebhookEventType covers lifecycle, timer, friend, API key, group events
- [ ] WebhookDelivery tracks retry state
- [ ] WebhookDeliveryPayload as discriminated union (plaintext vs encrypted)
- [ ] Unit tests for config validation

## References

- features.md section 9 (Custom webhooks)
- ADR 013 (API Authentication)
