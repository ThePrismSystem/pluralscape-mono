---
# api-jgoa
title: 'M5: Eliminate double DNS resolution in webhook delivery'
status: todo
type: task
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T09:52:48Z
parent: api-hvub
---

webhook-delivery-worker.ts:123-136 — resolveAndValidateUrl does DNS lookup, then fetch() resolves again. Doubles DNS latency per delivery.
