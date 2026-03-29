---
# api-n81d
title: Mitigate SSRF DNS rebinding TOCTOU in webhook delivery
status: completed
type: bug
priority: high
created_at: 2026-03-29T07:11:28Z
updated_at: 2026-03-29T07:44:09Z
parent: api-kjyg
---

webhook-delivery-worker.ts:123-136 resolves DNS for SSRF validation, then fetch() resolves again independently. An attacker controlling DNS can return a public IP first and 127.0.0.1 second. Either pass resolved IPs to fetch via connect-level hook, or connect directly to the IP with a Host header.

## Summary of Changes

Added buildIpPinnedFetchArgs helper and wired it into processWebhookDelivery to pin HTTP requests to the DNS-resolved IP, eliminating the TOCTOU rebinding window.
