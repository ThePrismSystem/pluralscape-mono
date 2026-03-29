---
# api-cnxi
title: Zero webhook HMAC secret buffer after use
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:11Z
parent: api-kjyg
---

webhook-delivery-worker.ts:142 creates Buffer.from(configSecret) for HMAC but never wipes it. Compare with recovery-key.service.ts which uses memzero(). Secret persists in JS heap until GC.
