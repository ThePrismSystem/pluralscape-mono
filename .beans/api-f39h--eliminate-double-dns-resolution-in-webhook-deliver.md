---
# api-f39h
title: Eliminate double DNS resolution in webhook delivery
status: todo
type: task
priority: normal
created_at: 2026-03-29T07:12:46Z
updated_at: 2026-03-29T07:13:23Z
parent: api-kjyg
blocked_by:
  - api-n81d
---

webhook-delivery-worker.ts:123-136 resolves DNS for SSRF validation then fetch() resolves again. Doubles DNS latency per delivery. If SSRF check returns resolved IPs, connect directly to the IP with a Host header to eliminate both the perf cost and the TOCTOU window (related to H3/api-n81d).
