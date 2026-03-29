---
# api-vsln
title: 'H8: Comprehensive webhook encryption round-trip tests'
status: completed
type: task
created_at: 2026-03-29T09:52:36Z
updated_at: 2026-03-29T09:52:36Z
parent: api-hvub
---

encryptWebhookPayload had no decryption round-trip test. Added tests for normal, empty, large, unicode, structural, and failure cases. Fixed in PR #319.
