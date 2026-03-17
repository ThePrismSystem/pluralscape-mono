# OWASP Top 10 Coverage — Pluralscape

## Coverage Matrix

| ID | Category | Tested | Findings | Status |
|----|----------|--------|----------|--------|
| A01 | Broken Access Control | Yes | 1 (TOCTOU in session revocation) | Partial — defense-in-depth gap |
| A02 | Cryptographic Failures | Yes | 2 (webhook T3, transfer code entropy) | Partial — design trade-offs |
| A03 | Injection | Yes | 1 (unbounded encryptedData) | Partial — no SQL/XSS/cmd injection |
| A04 | Insecure Design | Yes | 0 | Pass — rate limiting, FK enforcement, concurrency controls |
| A05 | Security Misconfiguration | Yes | 2 (ZodError leak, IP validation) | Partial |
| A06 | Vulnerable Components | Yes | 0 | Pass — 0 CVEs |
| A07 | Auth & Identification Failures | Yes | 1 (password schema inconsistency) | Partial |
| A08 | Software & Data Integrity | Yes | 0 | Pass — AEAD + Ed25519 on sync |
| A09 | Logging & Monitoring Failures | Yes | 1 (audit PII retention) | Partial |
| A10 | Server-Side Request Forgery | Yes | 0 | Pass — no outbound HTTP |

**Coverage: 10/10 categories tested**

---

## Per-Category Details

### A01 — Broken Access Control

- [x] IDOR on parameterized routes (`:id`) — All scoped to auth.accountId
- [x] Missing authorization middleware — Auth middleware on all protected routes
- [x] Horizontal privilege escalation — Queries filter by accountId
- [x] Vertical privilege escalation — accountType checked in service layer
- [x] Directory traversal on file operations — Multi-layer protection in filesystem adapter
- [x] CORS misconfiguration — Locked to CORS_ORIGIN whitelist
- [x] Function-level access control — Per-route middleware
- [x] Session revocation ownership — Check exists but TOCTOU gap (Finding 3)

### A02 — Cryptographic Failures

- [x] Sensitive data in plaintext — All keys encrypted; passwords hashed
- [x] Weak hashing — Argon2id with server profile (3 ops, 64 MiB)
- [x] Hardcoded secrets — None found; all from env vars
- [x] Encryption at rest — SQLCipher for SQLite; PG encryption via ops
- [x] Weak random generation — libsodium randomBytes throughout
- [x] Exposed .env files — .env excluded from git; .env.example has no secrets
- [ ] Webhook secrets server-readable — T3 by design (Finding 6)
- [ ] Transfer code entropy — Accepted trade-off (Finding 8)

### A03 — Injection

- [x] SQL injection — Drizzle ORM parameterized queries
- [x] Command injection — No exec/spawn in production
- [x] XSS — No dangerouslySetInnerHTML/innerHTML/eval
- [x] Template injection — No template engines
- [x] Path injection — Multi-layer traversal protection
- [x] Header injection (CRLF) — No user input in response headers
- [ ] Resource exhaustion via unbounded input — encryptedData no max (Finding 2)

### A04 — Insecure Design

- [x] Rate limiting on sensitive endpoints — authHeavy on login/register/recovery
- [x] Account lockout — Rate limiting serves this purpose
- [x] Predictable resource identifiers — UUIDs with branded prefixes
- [x] Race conditions — Optimistic locking with version fields
- [x] CSRF protection — Bearer token auth (no cookies)
- [x] SQLite foreign keys — PRAGMA enabled

### A05 — Security Misconfiguration

- [x] Debug mode — Production masking on 5xx errors
- [x] Default credentials — None
- [x] Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [x] Unnecessary HTTP methods — Only GET/POST/PUT/DELETE/PATCH/OPTIONS
- [ ] ZodError details in production — 400 responses include full error (Finding 1)
- [ ] IP format validation — X-Forwarded-For accepts arbitrary strings (Finding 4)

### A06 — Vulnerable and Outdated Components

- [x] Known CVEs — 0 via `pnpm audit`
- [x] Outdated frameworks — All current versions
- [x] Unmaintained dependencies — All actively maintained
- [x] Prototype pollution — No vulnerable patterns
- [x] Supply chain — Frozen lockfile, pinned overrides, Dependabot

### A07 — Identification and Authentication Failures

- [x] Password hashing — Argon2id server profile
- [x] Session management — Revocation, absolute + idle timeout
- [x] JWT vulnerabilities — N/A (opaque session tokens, no JWT)
- [x] Session invalidation on password change — Revokes all other sessions
- [x] Anti-timing — Dummy hash on login for non-existent accounts
- [x] Anti-enumeration — Fake recovery key in registration
- [ ] Password schema consistency — Registration uses min(1) at schema level (Finding 5)

### A08 — Software and Data Integrity

- [x] CI/CD integrity — Frozen lockfile, CodeQL analysis
- [x] Dependency signing — pnpm with integrity checks
- [x] Deserialization — Zod validation on all inputs
- [x] Sync data integrity — AEAD + Ed25519 on all CRDT envelopes

### A09 — Security Logging and Monitoring

- [x] Audit logs for security events — 21 event types
- [x] Failed auth logging — auth.login-failed events
- [x] Sensitive data in logs — Session tokens not logged
- [x] Log injection — Structured logging, no user input interpolation
- [ ] PII retention — IP/UA in plaintext, cleanup scheduling unverified (Finding 7)

### A10 — Server-Side Request Forgery

- [x] Unvalidated URLs — No outbound HTTP in production
- [x] DNS rebinding — N/A (no outbound requests)
- [x] Proxy/redirect — No redirect endpoints
