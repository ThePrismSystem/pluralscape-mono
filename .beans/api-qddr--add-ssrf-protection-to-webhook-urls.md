---
# api-qddr
title: Add SSRF protection to webhook URLs
status: completed
type: task
priority: critical
created_at: 2026-03-24T09:21:12Z
updated_at: 2026-03-24T09:40:43Z
parent: ps-4ioj
---

validateUrlProtocol only checks HTTPS in production. No validation against private/reserved IP ranges (127.x, 10.x, 169.254.x, etc). Delivery worker fetch() hits any URL. Add DNS resolution + IP range validation at both creation and delivery time.

## Summary of Changes

- Extended `apps/api/src/lib/ip-validation.ts` with `isPrivateIp()` function and exported constants for all blocked IPv4 CIDR ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8) and IPv6 ranges (::1, fc00::/7, fe80::/10, ::). Handles IPv4-mapped IPv6 addresses. Fails closed on invalid input.
- Created `apps/api/src/__tests__/lib/ip-validation.test.ts` with tests for all IPv4/IPv6 private ranges, public IPs, IPv4-mapped IPv6, and edge cases (empty string, invalid format, hostnames).
- Replaced `validateUrlProtocol` with async `validateWebhookUrl` in `apps/api/src/services/webhook-config.service.ts`. Performs DNS resolution and checks all resolved IPs against private ranges in production. Skips DNS resolution in non-production environments.
- Added pre-flight SSRF check in `apps/api/src/services/webhook-delivery-worker.ts` before fetch to prevent DNS rebinding attacks. Re-resolves hostname at delivery time and validates all IPs. Marks delivery as failed if URL resolves to private address.
