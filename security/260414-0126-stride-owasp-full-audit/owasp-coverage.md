# OWASP Top 10 Coverage — Pluralscape Full Audit

**Date:** 2026-04-14

| ID  | Category                                   | Tested | Findings   | Status            |
| --- | ------------------------------------------ | ------ | ---------- | ----------------- |
| A01 | Broken Access Control                      | Yes    | 0          | Clean             |
| A02 | Cryptographic Failures                     | Yes    | 1 (Info)   | Clean (Info only) |
| A03 | Injection                                  | Yes    | 0          | Clean             |
| A04 | Insecure Design                            | Yes    | 2 (Medium) | Issues found      |
| A05 | Security Misconfiguration                  | Yes    | 1 (Low)    | Issues found      |
| A06 | Vulnerable and Outdated Components         | Yes    | 0          | Clean             |
| A07 | Identification and Authentication Failures | Yes    | 1 (Info)   | Clean (Info only) |
| A08 | Software and Data Integrity Failures       | Yes    | 1 (Info)   | Clean (Info only) |
| A09 | Security Logging and Monitoring Failures   | Yes    | 0          | Clean             |
| A10 | Server-Side Request Forgery                | Yes    | 0          | Clean             |

**Coverage: 10/10 categories tested**

---

## Per-Category Results

### A01 — Broken Access Control

- [x] IDOR on parameterized routes — RLS enforces tenant isolation; system ownership via O(1) Set lookup
- [x] Missing authorization middleware — all protected routes require `authMiddleware()`
- [x] Horizontal privilege escalation — RLS `app.current_system_id` prevents cross-system access
- [x] Vertical privilege escalation — no admin role; account_type is system/viewer only
- [x] Directory traversal — blob storage `resolvePath()` rejects `..` and validates within root
- [x] CORS misconfiguration — fail-closed whitelist; CORS_ORIGIN required, no bare `*`
- [x] Function-level access control — scope gate middleware for API keys (fail-closed)

### A02 — Cryptographic Failures

- [x] Sensitive data in plaintext — master keys wrapped via Argon2id-KEK, email encrypted, tokens hashed
- [x] Weak hashing algorithms — Argon2id with OWASP Sensitive parameters (t=4, m=65536)
- [x] Hardcoded secrets — none; all secrets via env vars with production validation
- [x] Encryption at rest — XChaCha20-Poly1305 for all user data; email, webhooks encrypted
- [x] Weak random generation — libsodium `randomBytes` for all security tokens
- [x] Exposed config — `.env.example` has placeholders only
- [x] Memory zeroing — `adapter.memzero()` on all key material after use

**Finding:** INFO — Webhook recipients should use timing-safe comparison for HMAC verification

### A03 — Injection

- [x] SQL injection — Drizzle ORM parameterized queries throughout; no raw user input in SQL
- [x] Command injection — no shell execution (`exec`, `spawn`) found in API
- [x] XSS — API-only server, no HTML rendering; CSP `default-src 'none'`
- [x] Template injection — email templates use `escapeHtml()` for all dynamic content
- [x] Path injection — blob storage validates resolved path within root directory
- [x] Header injection — Hono framework handles header encoding
- [x] SQLite injection (mobile) — parameterized queries with `?` placeholders, table name allowlist

### A04 — Insecure Design

- [x] Missing rate limiting — category-based rate limiting on all endpoints
- [x] Account lockout — per-account login throttle (10 attempts / 15 min)
- [x] Predictable identifiers — CUID2 with type prefixes (non-sequential)
- [x] Race conditions — SELECT...FOR UPDATE on quota checks; TOCTOU prevention in friend access
- [x] CSRF protection — Bearer token auth (not cookie-based)
- [x] Resource quotas — **partial**: most entities have quotas, but notes/innerworld entities do not

**Findings:**

- MEDIUM — Notes and innerworld entities lack per-system quotas
- MEDIUM — Import parser materializes full document tree in memory

### A05 — Security Misconfiguration

- [x] Debug mode — `DISABLE_RATE_LIMIT` forced off in production
- [x] Default credentials — none; all secrets must be explicitly configured
- [x] Verbose errors — 5xx masked in production; Zod errors sanitized
- [x] Security headers — CSP `default-src 'none'`, HSTS (2yr), X-Frame-Options DENY, Permissions-Policy restrictive
- [x] SMTP security — runtime guard refuses plaintext SMTP in production

**Finding:** LOW — Mobile data layer exposes raw error JSON in thrown errors

### A06 — Vulnerable and Outdated Components

- [x] `pnpm audit` — 0 vulnerabilities across 1,415 dependencies
- [x] CI/CD — `pnpm audit --audit-level=moderate` in CI pipeline
- [x] Supply chain — GitHub Actions pinned with SHA256 checksums; frozen lockfile enforcement

### A07 — Identification and Authentication Failures

- [x] Password policy — minimum 8 characters, maximum 250
- [x] Session management — absolute TTL + idle timeout, platform-specific timeouts
- [x] JWT vulnerabilities — N/A (not using JWT; session tokens are opaque random values)
- [x] Session invalidation — revocation on password change, recovery, account deletion
- [x] API key security — HMAC-SHA256 hashed, scope-gated, revocable, expirable

**Finding:** INFO — lastActive fire-and-forget TOCTOU (accepted)

### A08 — Software and Data Integrity Failures

- [x] CI/CD integrity — GitHub Actions pinned by SHA; minimal permissions
- [x] Dependency signing — frozen lockfile prevents supply chain manipulation
- [x] Deserialization — no `eval()` or `Function()` usage; JSON.parse with Zod validation
- [x] Webhook integrity — HMAC-SHA256 signing with secret per webhook config

**Finding:** INFO — Queue job payloads lack integrity MAC

### A09 — Security Logging and Monitoring Failures

- [x] Audit logs — comprehensive event types (login, logout, password change, deletion, key rotation, purge)
- [x] Failed auth logging — login failures recorded; per-account throttle tracks attempts
- [x] Sensitive data in logs — S3 log sanitizer; structured Pino logging; no tokens/passwords logged
- [x] Access logging — method/path/status/duration per request

### A10 — Server-Side Request Forgery

- [x] Webhook URL validation — DNS resolution + IP validation against comprehensive blocked ranges
- [x] IP pinning — `buildIpPinnedFetchArgs()` used in webhook delivery to prevent DNS rebinding
- [x] Private IP ranges — 13 IPv4 ranges + 4 IPv6 ranges blocked (loopback, private, link-local, CGNAT, reserved)
- [x] IPv4-mapped IPv6 — specifically handled to prevent bypass via `::ffff:127.0.0.1`
- [x] Fail-closed — invalid/unresolvable IPs treated as private
