---
# api-svf0
title: Remove duplicated pure-function tests from integration suite
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

calculateBackoffMs and computeWebhookSignature are tested identically in both webhook-delivery-worker.test.ts (unit) and .integration.test.ts. These pure functions have no I/O dependency — remove from integration file.
