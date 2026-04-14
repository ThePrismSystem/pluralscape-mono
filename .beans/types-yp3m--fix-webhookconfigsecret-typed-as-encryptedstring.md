---
# types-yp3m
title: Fix WebhookConfig.secret typed as EncryptedString
status: completed
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-14T14:53:23Z
parent: ps-4ioj
---

WebhookConfig.secret uses EncryptedString branded type but DB stores raw HMAC bytes (pgBinary). Semantic mismatch - should use ServerSecret or similar.

## Summary of Changes\n\nReplaced EncryptedString with new ServerSecret branded type (Uint8Array-based) on WebhookConfig.secret. Updated mapper and imports.
