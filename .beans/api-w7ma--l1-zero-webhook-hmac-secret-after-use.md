---
# api-w7ma
title: 'L1: Zero webhook HMAC secret after use'
status: todo
type: task
priority: low
created_at: 2026-03-29T09:53:02Z
updated_at: 2026-03-29T09:53:02Z
parent: api-hvub
---

webhook-delivery-worker.ts:142 — Buffer.from(configSecret) copy never wiped. Compare with memzero() in recovery-key.service.ts.
