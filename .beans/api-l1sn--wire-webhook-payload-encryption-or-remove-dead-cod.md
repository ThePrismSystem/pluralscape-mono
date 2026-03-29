---
# api-l1sn
title: Wire webhook payload encryption into dispatch path
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T08:21:14Z
parent: api-kjyg
---

encryptWebhookPayload in webhook-payload-encryption.ts exists but is never called. payloadData is written as plaintext JSONB. Wire encryptWebhookPayload into the dispatch path in webhook-dispatcher.ts so payloads are encrypted before storage. Populate the encryptedData and cryptoKeyId columns. Update the delivery worker to decrypt before sending. Schema columns (encryptedData, cryptoKeyId) can remain as they are migration-controlled.

## Summary of Changes

Rewrote webhook-payload-encryption.ts from AES-256-GCM to XChaCha20-Poly1305 (matching email-encrypt.ts pattern). Added WEBHOOK_PAYLOAD_ENCRYPTION_KEY env var. Dispatcher now encrypts payloads before INSERT when key is configured, falls back to plaintext JSONB. Delivery worker reads encrypted or plaintext payload from DB row. Removed payload from webhook-deliver job type. Changed encryptedData column from pgEncryptedBlob to pgBinary.
