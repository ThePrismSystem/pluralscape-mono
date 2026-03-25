---
# ps-8al7
title: Security Audit Remediation (2026-03-24)
status: completed
type: epic
priority: high
created_at: 2026-03-24T21:48:36Z
updated_at: 2026-03-24T22:43:25Z
---

Address all 12 findings from the 2026-03-24 STRIDE/OWASP security audit. Report: security/260324-2124-stride-owasp-full-audit/overview.md

## Summary of Changes

All 12 security audit findings from the 2026-03-24 STRIDE/OWASP audit have been remediated:

1. **RLS tenant context activation** (HIGH) — 28 service files + helper, 108 call sites
2. **Fake recovery key algorithm** (LOW) — Aligned with real base32 encoding
3. **Login throttle enumeration** (MEDIUM) — Await throttle recording for non-existent accounts
4. **Biometric token replay** (MEDIUM) — Added usedAt column, atomic UPDATE...RETURNING
5. **WebSocket per-IP limiting** (MEDIUM) — Per-IP tracking in ConnectionManager, TRUST_PROXY-gated
6. **Security headers** (MEDIUM) — Added Permissions-Policy (Referrer-Policy already set by Hono)
7. **Per-account session limit** (MEDIUM) — MAX_SESSIONS_PER_ACCOUNT=50, oldest evicted
8. **Blob upload race** (MEDIUM) — FOR UPDATE lock on confirmation SELECT
9. **Password reset timing** (LOW) — equalizeAntiEnumTiming in finally block
10. **Envelope signature toggle** (LOW) — WARN log when verification disabled
11. **Key rotation sealing race** (LOW) — FOR UPDATE on content tags during sealing
12. **Webhook deletion TOCTOU** (LOW) — FOR UPDATE on config row before delete
