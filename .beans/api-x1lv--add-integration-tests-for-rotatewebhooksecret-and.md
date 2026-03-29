---
# api-x1lv
title: Add integration tests for rotateWebhookSecret and testWebhookConfig
status: completed
type: task
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:46:16Z
parent: api-kjyg
---

Both rotateWebhookSecret and testWebhookConfig are tested only via unit mocks. Add PGlite integration tests in webhook-config.service.integration.test.ts covering: OCC conflict handling, version increment atomicity, correct secret reads from DB, and HMAC signing with real secret.

## Summary of Changes

Added 7 integration tests: 3 for rotateWebhookSecret (success, OCC conflict, not found) and 4 for testWebhookConfig (200 success, 500 failure, network error, not found).
