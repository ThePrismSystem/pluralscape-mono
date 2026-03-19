# OWASP Top 10 Coverage — Pluralscape

## Coverage Matrix

| ID  | Category                       | Tested | Findings   | Status                                                                         |
| --- | ------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------ |
| A01 | Broken Access Control          | Yes    | 1 (Low)    | Partial — defense-in-depth gap in session revocation                           |
| A02 | Cryptographic Failures         | Yes    | 2 (Low)    | Partial — recurring design trade-offs (webhook secrets, transfer code entropy) |
| A03 | Injection                      | Yes    | 0          | Pass — Drizzle ORM parameterized queries, no raw SQL, no XSS vectors           |
| A04 | Insecure Design                | Yes    | 1 (Medium) | Partial — password max length inconsistency                                    |
| A05 | Security Misconfiguration      | Yes    | 0          | Pass — ZodError masking fixed, headers correct, CORS locked down               |
| A06 | Vulnerable Components          | Yes    | 0          | Pass — 0 CVEs in dependencies                                                  |
| A07 | Auth & Identification Failures | Yes    | 2 (Medium) | Partial — login timing side-channel, password reset path differentiation       |
| A08 | Software & Data Integrity      | Yes    | 0          | Pass — Argon2id, BLAKE2b hashing, AEAD encryption                              |
| A09 | Security Logging & Monitoring  | Yes    | 1 (Low)    | Partial — audit log PII retention                                              |
| A10 | Server-Side Request Forgery    | Yes    | 0          | Pass — no outbound HTTP requests in production                                 |

## Detailed Results

### A01 — Broken Access Control

- [x] IDOR on all parameterized routes — All queries scoped to auth.accountId + systemId
- [x] Missing authorization middleware — Auth middleware on all protected routes
- [x] Horizontal privilege escalation — RLS + application-level ownership checks
- [x] Vertical privilege escalation — Single role model (no admin vs user distinction yet)
- [x] Directory traversal — Multi-layer path check in filesystem adapter
- [x] CORS misconfiguration — Explicit origin list, no wildcards
- [x] Function-level access control — All routes require authentication except /auth/register, /auth/login, /auth/password-reset
- [ ] Session revocation TOCTOU — Pre-transaction check is redundant dead code (Low)

### A02 — Cryptographic Failures

- [x] Sensitive data in plaintext — E2E encryption (XChaCha20-Poly1305) for all user data
- [x] Weak hashing algorithms — Argon2id (256MB/3 iter) for passwords, BLAKE2b for tokens
- [x] Hardcoded secrets — No hardcoded secrets; all via environment variables
- [x] Missing encryption at rest — SQLCipher for SQLite, server-side encrypted blobs
- [x] Weak random number generation — libsodium CSPRNG for all tokens and keys
- [x] Exposed .env files — .env in .gitignore
- [ ] Webhook HMAC secrets server-readable — Design trade-off (Low, recurring)
- [ ] Device transfer code entropy — 26.5 bits, protected by Argon2id + timeout (Low, recurring)

### A03 — Injection

- [x] SQL injection — Drizzle ORM parameterized queries, no raw SQL anywhere
- [x] Command injection — No exec/spawn in production code
- [x] XSS — No dangerouslySetInnerHTML, innerHTML, eval
- [x] Template injection — No server-side templating
- [x] Path injection — Multi-layer traversal protection in filesystem adapter
- [x] Header injection — Hono framework handles header encoding

### A04 — Insecure Design

- [x] Rate limiting — Global + per-category limits on all endpoints
- [x] Account lockout — Not yet implemented, but rate limited to 5/min
- [x] Predictable identifiers — CUID2 with prefixes, not sequential
- [x] Race conditions — Optimistic locking with version fields
- [x] CSRF protection — API-only (no cookies), token-based auth
- [ ] Password max length inconsistency — Registration and change-password missing `.max()` (Medium)

### A05 — Security Misconfiguration

- [x] Debug mode — Production error masking enabled
- [x] Default credentials — No default passwords
- [x] Verbose error messages — ZodError masked in production (FIXED since last audit)
- [x] Security headers — CSP, HSTS, X-Frame-Options all set
- [x] Unnecessary HTTP methods — Only used methods registered per route
- [x] Stack traces — Masked in production

### A06 — Vulnerable and Outdated Components

- [x] Known CVEs — `pnpm audit` returns 0 vulnerabilities
- [x] Outdated frameworks — All dependencies current
- [x] Prototype pollution — No vulnerable patterns

### A07 — Identification and Authentication Failures

- [x] Weak password policies — min 8 chars enforced at schema + service level
- [x] Session fixation — New session on every login, tokens never reused
- [x] JWT vulnerabilities — Not applicable (session-based, no JWT)
- [x] Insecure password reset — Recovery key (256-bit) with timing equalization
- [x] Session invalidation on password change — All other sessions revoked
- [ ] Login timing side-channel — Audit write creates timing delta (Medium)
- [ ] Password reset path differentiation — Different error paths with different timing (Medium)

### A08 — Software and Data Integrity

- [x] CI/CD integrity — Frozen lockfile, minimal permissions
- [x] Dependency verification — pnpm with integrity checks
- [x] Deserialization — Zod schema parsing, no raw JSON.parse on user input
- [x] Webhook verification — HMAC signatures planned (feature not yet implemented)

### A09 — Security Logging and Monitoring Failures

- [x] Audit logs for security events — 21 event types, comprehensive coverage
- [x] Failed authentication logging — Login failures audited
- [x] Log injection — Structured logging, no user input in log format strings
- [ ] Sensitive data in logs — IP + user agent stored plaintext (Low, recurring)
- [ ] Alerting — Not yet implemented (pre-production)

### A10 — Server-Side Request Forgery

- [x] Unvalidated URLs — No outbound HTTP requests in production API
- [x] DNS rebinding — Not applicable (no outbound requests)
- [x] External service allowlist — S3 SDK handles endpoint configuration
