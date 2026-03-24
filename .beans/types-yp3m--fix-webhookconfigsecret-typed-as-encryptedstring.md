---
# types-yp3m
title: Fix WebhookConfig.secret typed as EncryptedString
status: todo
type: bug
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-03-24T09:25:31Z
parent: ps-4ioj
---

WebhookConfig.secret uses EncryptedString branded type but DB stores raw HMAC bytes (pgBinary). Semantic mismatch - should use ServerSecret or similar.
