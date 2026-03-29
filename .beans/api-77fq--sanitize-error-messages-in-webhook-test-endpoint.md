---
# api-77fq
title: Sanitize error messages in webhook test endpoint
status: completed
type: bug
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

webhook-config.service.ts:648 returns err.message from TypeError directly in WebhookTestResult. Network-level TypeError messages can expose internal DNS failures, IP addresses, or socket errors. Map to generic error messages.
