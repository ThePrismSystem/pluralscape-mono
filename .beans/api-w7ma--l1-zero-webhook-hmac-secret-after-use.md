---
# api-w7ma
title: "L1: Zero webhook HMAC secret after use"
status: completed
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-delivery-worker.ts:142 — Buffer.from(configSecret) copy never wiped. Compare with memzero() in recovery-key.service.ts.

## Summary of Changes\n\nWrapped secret Buffer in try/finally with fill(0) in both testWebhookConfig and processWebhookDelivery.
