# OWASP Top 10 Coverage — Pluralscape Security Audit

## Coverage Matrix

| ID | Category | Tested | Findings | Status |
|----|----------|--------|----------|--------|
| A01 | Broken Access Control | Yes | 1 (Info: RLS fail-closed) | Pass (RLS well-designed; API auth not yet needed) |
| A02 | Cryptographic Failures | Yes | 2 (Medium: webhook secret T3; Low: transfer code entropy) | Partial (strong crypto, minor design gaps) |
| A03 | Injection | Yes | 0 | Pass (Drizzle ORM, no exec/eval/innerHTML) |
| A04 | Insecure Design | Yes | 3 (Medium: rate limiting, SQLite FK, QR code design) | Issues (early-stage gaps) |
| A05 | Security Misconfiguration | Yes | 3 (Medium: headers, CORS, error handler) | Issues (no middleware configured) |
| A06 | Vulnerable Components | Yes | 0 | Pass (0 npm audit advisories) |
| A07 | Auth & Identification Failures | Yes | 2 (High: no auth middleware; Medium: no password policy) | Issues (not yet implemented) |
| A08 | Software & Data Integrity Failures | Yes | 0 (Info: sync integrity verified) | Pass (Ed25519 signatures, AEAD) |
| A09 | Security Logging & Monitoring | Yes | 1 (Low: audit log PII in plaintext) | Partial (good audit events, PII retention gap) |
| A10 | Server-Side Request Forgery | Yes | 0 | Pass (no outbound HTTP in production code) |

## Per-Category Detail

### A01 — Broken Access Control
- [x] IDOR on parameterized routes: N/A (no parameterized routes exist)
- [x] Missing authorization middleware: Confirmed (Finding 1 — no auth middleware)
- [x] Horizontal privilege escalation: N/A (no multi-user routes exist)
- [x] Vertical privilege escalation: N/A (no role-based routes exist)
- [x] Directory traversal: Not applicable (storage keys use branded IDs)
- [x] CORS misconfiguration: Confirmed (Finding 4)
- [x] RLS fail-closed design: Verified (NULLIF pattern)

### A02 — Cryptographic Failures
- [x] Sensitive data in plaintext: Webhook secrets are T3 (Finding 7)
- [x] Weak hashing: Not found (Argon2id, BLAKE2b)
- [x] Hardcoded secrets: Not found
- [x] Missing encryption at rest: SQLCipher for mobile, PG TDE recommended
- [x] Weak PRNG: Not found (libsodium randombytes)
- [x] Exposed .env files: .env gitignored, .env.example has no secrets

### A03 — Injection
- [x] SQL injection: Not found (Drizzle ORM parameterized queries)
- [x] Command injection: Not found (no exec/spawn in production)
- [x] XSS: Not found (no innerHTML/eval/dangerouslySetInnerHTML in production)
- [x] Template injection: Not applicable
- [x] Path injection: Not applicable (branded storage keys)

### A04 — Insecure Design
- [x] Missing rate limiting: Confirmed (Finding 3)
- [x] No account lockout: N/A (auth not implemented)
- [x] Predictable identifiers: Not found (UUIDs with prefix)
- [x] Race conditions: Not testable (no concurrent-write endpoints)
- [x] Missing CSRF: N/A (API-only, no cookie-based auth yet)
- [x] SQLite FK enforcement: Missing (Finding 5)

### A05 — Security Misconfiguration
- [x] Debug mode: Not found
- [x] Default credentials: Not found
- [x] Verbose errors: Risk present (Finding 8 — no error handler)
- [x] Missing security headers: Confirmed (Finding 2)
- [x] Unnecessary HTTP methods: Not testable (minimal routes)

### A06 — Vulnerable Components
- [x] Known CVEs: 0 advisories (pnpm audit)
- [x] Outdated frameworks: Up to date
- [x] Prototype pollution deps: Not found

### A07 — Auth & Identification Failures
- [x] Weak password policy: Confirmed (Finding 6)
- [x] Missing MFA: N/A (auth not implemented)
- [x] Session fixation: N/A (session management exists in schema only)
- [x] JWT vulnerabilities: N/A (no JWT usage found)
- [x] Session invalidation: Schema supports revocation (sessions.revoked)

### A08 — Software & Data Integrity Failures
- [x] CI/CD integrity: GitHub Actions with actions/checkout, CodeQL
- [x] Unsigned dependencies: Dependabot monitors weekly
- [x] Insecure deserialization: JSON.parse on decrypted data (safe context)
- [x] Sync integrity: Ed25519 + AEAD verified

### A09 — Security Logging & Monitoring
- [x] Audit logging: 21 event types defined
- [x] Failed auth logging: `auth.login-failed` event type exists
- [x] Sensitive data in logs: IP/UA in plaintext (Finding 10)
- [x] Log injection: Not applicable (structured audit log table)

### A10 — Server-Side Request Forgery
- [x] Unvalidated URLs: No outbound HTTP in production
- [x] DNS rebinding: N/A
- [x] Missing allowlist: N/A
- [x] Proxy endpoints: None exist
