---
# api-wlh6
title: Document timing-safe HMAC comparison for webhook recipients
status: completed
type: task
priority: low
created_at: 2026-04-14T06:40:10Z
updated_at: 2026-04-14T06:52:37Z
parent: ps-9ujv
---

**Finding 7 (Info)** — OWASP A02, STRIDE Spoofing

Server correctly generates HMAC-SHA256 signatures for webhooks. However, webhook recipients (external code) may use naive string comparison for verification, which is vulnerable to timing attacks.

**Fix:** Add webhook integration documentation recommending crypto.timingSafeEqual() or equivalent.

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-7

## Summary of Changes

Already documented — no code changes required.

`docs/guides/webhook-signature-verification.md:27` documents "constant-time comparison" as step 4. Line 59 provides a `crypto.timingSafeEqual` Node.js example. `docs/guides/api-consumer-guide.md:952` also covers this. Python and Go examples included.
