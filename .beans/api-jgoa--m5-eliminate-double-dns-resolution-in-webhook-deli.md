---
# api-jgoa
title: "M5: Eliminate double DNS resolution in webhook delivery"
status: completed
type: task
priority: normal
created_at: 2026-03-29T09:52:48Z
updated_at: 2026-03-29T10:31:12Z
parent: api-hvub
---

webhook-delivery-worker.ts:123-136 — resolveAndValidateUrl does DNS lookup, then fetch() resolves again. Doubles DNS latency per delivery.

## Summary of Changes\n\nImplemented IP-pinned fetch via buildIpPinnedUrl using resolved IPs from resolveAndValidateUrl. Host header set for pinned requests.
