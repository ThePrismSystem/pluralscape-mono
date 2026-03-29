---
# api-k2zf
title: "M2: Sanitize webhook test endpoint error messages"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:47Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-config.service.ts:648 — err.message from TypeError returned directly, potentially exposing DNS failures, IP addresses, or socket errors.

## Summary of Changes\n\nReplaced raw error.message exposure with generic 'Webhook endpoint request failed (network error)' message.
