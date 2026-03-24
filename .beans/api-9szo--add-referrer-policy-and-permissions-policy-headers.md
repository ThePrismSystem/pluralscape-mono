---
# api-9szo
title: Add Referrer-Policy and Permissions-Policy headers
status: completed
type: task
priority: normal
created_at: 2026-03-24T21:49:08Z
updated_at: 2026-03-24T21:59:03Z
parent: ps-8al7
---

Security headers middleware is missing Referrer-Policy and Permissions-Policy. Add both to secure-headers.ts.

**Audit ref:** Finding 6 (MEDIUM) — A05 Security Misconfiguration / InfoDisc
**File:** apps/api/src/middleware/secure-headers.ts:15-28

## Summary of Changes

Added Permissions-Policy header (camera=(), microphone=(), geolocation=()) to secure-headers.ts. Referrer-Policy was already set by Hono's defaults (no-referrer). Added tests for both headers.
