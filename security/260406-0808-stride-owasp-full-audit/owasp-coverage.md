# OWASP Top 10 Coverage — Pluralscape Full Audit

**Date:** 2026-04-06

## Coverage Matrix

| ID  | Category                       | Tested | Findings             | Status                   |
| --- | ------------------------------ | ------ | -------------------- | ------------------------ |
| A01 | Broken Access Control          | ✓      | 1 (Medium)           | ⚠️ API key auth gap      |
| A02 | Cryptographic Failures         | ✓      | 0                    | ✅ Clean                 |
| A03 | Injection                      | ✓      | 0                    | ✅ Clean                 |
| A04 | Insecure Design                | ✓      | 1 (Low)              | ⚠️ Missing entity quotas |
| A05 | Security Misconfiguration      | ✓      | 2 (1 High, 1 Medium) | ⚠️ SMTP + CSP            |
| A06 | Vulnerable Components          | ✓      | 0                    | ✅ Clean                 |
| A07 | Auth & Identification Failures | ✓      | 1 (Low)              | ⚠️ Recovery rate limit   |
| A08 | Software & Data Integrity      | ✓      | 0                    | ✅ Clean                 |
| A09 | Logging & Monitoring Failures  | ✓      | 1 (Info)             | ⚠️ Missing audit event   |
| A10 | Server-Side Request Forgery    | ✓      | 1 (Medium)           | ⚠️ DNS rebinding         |

**Coverage: 10/10 categories tested**

## Per-Category Detail

### A01 — Broken Access Control

- [x] IDOR on all parameterized routes — **PASS**: `ownedSystemIds` check via `assertSystemOwnership()`
- [x] Missing authorization middleware — **PASS**: All system-scoped endpoints use `systemProcedure`
- [x] Horizontal privilege escalation — **PASS**: RLS policies enforce account/system isolation
- [x] Vertical privilege escalation — **N/A**: No admin endpoints exist
- [x] Directory traversal — **PASS**: No file system operations with user input
- [x] CORS misconfiguration — **PASS**: Wildcard matching validates dot-prefix, bare `*` rejected
- [x] Function-level access control — **FINDING**: API key scope enforcement not implemented

### A02 — Cryptographic Failures

- [x] Sensitive data in plaintext — **PASS**: Two-tier encryption model, email encrypted
- [x] Weak hashing — **PASS**: No MD5/SHA1, uses BLAKE2b + Argon2id
- [x] Hardcoded secrets — **PASS**: All secrets in env vars, .env gitignored
- [x] Missing encryption at rest — **PASS**: SQLCipher (mobile), XChaCha20 (server)
- [x] Weak RNG — **PASS**: All crypto uses libsodium.randombytes_buf()
- [x] Nonce reuse — **PASS**: Fresh 24-byte nonce per encryption, XChaCha20 192-bit nonce space

### A03 — Injection

- [x] SQL injection — **PASS**: Drizzle ORM parameterized queries, no raw SQL with user input
- [x] Command injection — **PASS**: No child_process with user input
- [x] XSS — **N/A**: Pure API, no HTML rendering
- [x] Template injection — **PASS**: No dynamic template rendering
- [x] Path injection — **PASS**: No fs operations with user input
- [x] Header injection — **PASS**: No user input in response headers
- [x] Log injection — **PASS**: Pino structured logging, no string interpolation

### A04 — Insecure Design

- [x] Missing rate limiting — **PASS**: Per-category rate limiting on all endpoints
- [x] No account lockout — **PASS**: 10-attempt throttle per 15-min window
- [x] Predictable identifiers — **PASS**: Branded UUIDs with prefix validation
- [x] Race conditions — **PASS**: Idempotency, OCC, FOR UPDATE locks
- [x] CSRF — **PASS**: Bearer token auth, no cookie-based paths
- [x] Resource limits — **FINDING**: No quotas for members, groups, custom fronts

### A05 — Security Misconfiguration

- [x] Debug mode — **PASS**: Stack traces masked in production
- [x] Default credentials — **N/A**: No default admin accounts
- [x] Verbose errors — **PASS**: Generic error messages in production
- [x] Security headers — **FINDING**: CSP incomplete (default-src only)
- [x] SMTP security — **FINDING**: SMTP_SECURE not enforced in production
- [x] Stack traces in errors — **PASS**: Production error handler sanitizes

### A06 — Vulnerable and Outdated Components

- [x] Known CVEs — **PASS**: `pnpm audit` reports 0 vulnerabilities
- [x] Outdated frameworks — **PASS**: Active maintenance, recent versions
- [x] Security overrides — **PASS**: pnpm overrides patch known CVE-affected packages
- [x] Prototype pollution — **PASS**: No vulnerable patterns detected

### A07 — Identification and Authentication Failures

- [x] Weak password policies — **PASS**: Argon2id with OWASP Sensitive parameters
- [x] Session fixation — **PASS**: New session on every login
- [x] JWT vulnerabilities — **N/A**: No JWT, uses opaque session tokens
- [x] Insecure password reset — **PASS**: Recovery keys are single-use, high entropy
- [x] Session invalidation — **PASS**: Revocation flag, idle timeout, absolute expiry
- [x] Recovery key rate limiting — **FINDING**: Uses global rate limit, not per-account

### A08 — Software and Data Integrity

- [x] CI/CD pipeline integrity — **PASS**: All actions SHA-pinned, minimal permissions
- [x] Unsigned dependencies — **PASS**: pnpm-lock.yaml committed, frozen lockfile in CI
- [x] Insecure deserialization — **PASS**: All JSON.parse guarded with Zod validation
- [x] Webhook signing — **PASS**: HMAC-SHA256 with timestamp, optional encryption

### A09 — Security Logging and Monitoring

- [x] Audit logs for security events — **PASS**: Comprehensive event types
- [x] Failed auth logging — **PASS**: Login failures logged
- [x] Sensitive data in logs — **PASS**: No PII/secrets in log output
- [x] Session revocation logging — **FINDING**: No explicit session-revoked event

### A10 — Server-Side Request Forgery

- [x] Unvalidated URLs — **PASS**: Webhook URLs validated against IP blocklist
- [x] DNS rebinding — **FINDING**: IP pinning available but not used in delivery
- [x] Missing allowlist — **PASS**: Private/loopback/metadata IPs blocked
- [x] Proxy/redirect validation — **PASS**: No open redirect endpoints
