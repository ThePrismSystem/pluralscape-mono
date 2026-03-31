---
# api-3b2d
title: "Security audit: rate limiting, headers, and CORS"
status: completed
type: task
priority: high
created_at: 2026-03-29T02:59:10Z
updated_at: 2026-03-30T22:44:48Z
parent: api-e7gt
---

Audit and tune rate limiting, security headers, and CORS configuration.

## Scope

### Rate Limiting

- Current tiers: `authHeavy` (5/min), `authLight` (20/min), `global`
- Audit every endpoint's rate limit tier assignment — is it appropriate?
- Sensitive endpoints need tighter limits: login, register, password reset, recovery key, 2FA verification
- Bulk/list endpoints may need separate tier to prevent scraping
- Webhook delivery endpoints (external-facing) need rate limit consideration
- Rate limit bypass: verify `DISABLE_RATE_LIMIT` cannot be set in production
- Rate limit storage: verify Valkey-backed rate limiting works correctly under load
- Rate limit headers: verify `X-RateLimit-*` headers are accurate

### Security Headers

- `Strict-Transport-Security` (HSTS) with appropriate max-age
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` appropriate for API (not serving HTML)
- `X-Request-ID` for tracing (already present — verify unique and not user-controllable)
- `Cache-Control` on sensitive responses (no caching auth data)
- Remove or verify `X-Powered-By` is not present

### CORS

- Allowed origins are explicitly configured (no wildcard in production)
- Credentials mode is appropriate
- Allowed methods match actual endpoint methods
- Allowed headers are minimal and correct
- Preflight caching (`Access-Control-Max-Age`) is set
- CORS config is environment-aware (dev vs. production)

### TLS / Transport

- Verify API enforces HTTPS in production (redirect or reject HTTP)
- Verify `Secure` flag on any cookies (if applicable)
- Verify `TRUST_PROXY` handling is safe (X-Forwarded-For spoofing prevention)

## Checklist

- [x] Map every endpoint to its rate limit tier
- [x] Identify endpoints with inappropriate rate limit tier
- [x] Tune rate limits per endpoint sensitivity (all appropriate)
- [x] Verify rate limit bypass cannot activate in production
- [x] Audit all security headers
- [x] Add missing security headers (Cache-Control: no-store)
- [x] Audit CORS configuration for production safety
- [x] Audit TRUST_PROXY and X-Forwarded-For handling
- [x] Verify Cache-Control on sensitive endpoints
- [x] Fix all issues found

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes

Full audit completed. All 304 routes have appropriate rate limit tiers. DISABLE_RATE_LIMIT double-guarded against production use. Security headers complete (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy). CORS safe with explicit origins. TRUST_PROXY handling correct with IP validation and SSRF protection.

Fixes applied:

- Cache-Control: no-store added to login, register, sessions, account/get, recovery-key endpoints

Audit report: docs/local-audits/015-api-security-audit-2026-03-30.md
