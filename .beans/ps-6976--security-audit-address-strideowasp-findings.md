---
# ps-6976
title: "Security audit: address STRIDE/OWASP findings"
status: completed
type: task
priority: normal
created_at: 2026-03-15T08:45:52Z
updated_at: 2026-03-15T21:56:21Z
parent: ps-vtws
---

Address findings from security/260315-0835-stride-owasp-full-audit. See recommendations.md for prioritized mitigations.

## Tasks

- [x] Commit 1: Enable PRAGMA foreign_keys in SQLite client factory
- [x] Commit 2: Tighten keyVersion validation to >= 1
- [x] Commit 3: Add minimum password length to derivePasswordKey
- [x] Commit 4: Add security headers, CORS, and global error handler
- [x] Commit 5: Add in-memory rate limiting middleware
- [x] Create follow-up beans for deferred items (api-xmuv, api-4pl2, infra-gvgo)
- [x] Final verification (typecheck, lint, all tests)

## Summary of Changes

Addressed 7 of 11 STRIDE/OWASP audit findings:

- FK pragma enforcement in SQLite factory (defense-in-depth)
- keyVersion validation tightened to >= 1 (matching DB CHECK constraint)
- Password minimum length of 8 chars enforced in both derivation paths
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- CORS middleware with env-based origin allowlist
- Global error handler (no stack trace leakage)
- In-memory rate limiter (100 req/60s global, per-IP)

Deferred items tracked as follow-up beans: api-xmuv, api-4pl2, infra-gvgo.
