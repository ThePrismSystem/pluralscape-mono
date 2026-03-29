---
# api-3b2d
title: "Security audit: rate limiting, headers, and CORS"
status: todo
type: task
priority: high
created_at: 2026-03-29T02:59:10Z
updated_at: 2026-03-29T03:03:11Z
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

- [ ] Map every endpoint to its rate limit tier
- [ ] Identify endpoints with inappropriate rate limit tier
- [ ] Tune rate limits per endpoint sensitivity
- [ ] Verify rate limit bypass cannot activate in production
- [ ] Audit all security headers
- [ ] Add missing security headers
- [ ] Audit CORS configuration for production safety
- [ ] Audit TRUST_PROXY and X-Forwarded-For handling
- [ ] Verify Cache-Control on sensitive endpoints
- [ ] Fix all issues found

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
