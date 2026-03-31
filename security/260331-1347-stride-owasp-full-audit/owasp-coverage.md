# OWASP Top 10 Coverage Matrix

## Summary

| ID  | Category                               | Tested | Findings   | Status       |
| --- | -------------------------------------- | ------ | ---------- | ------------ |
| A01 | Broken Access Control                  | Yes    | 0          | Clean        |
| A02 | Cryptographic Failures                 | Yes    | 1 (Info)   | Clean        |
| A03 | Injection                              | Yes    | 0          | Clean        |
| A04 | Insecure Design                        | Yes    | 3 (Low)    | Minor issues |
| A05 | Security Misconfiguration              | Yes    | 0          | Clean        |
| A06 | Vulnerable Components                  | Yes    | 0          | Clean        |
| A07 | Auth & Identification Failures         | Yes    | 2 (Medium) | Issues found |
| A08 | Software & Data Integrity Failures     | Yes    | 0          | Clean        |
| A09 | Security Logging & Monitoring Failures | Yes    | 0          | Clean        |
| A10 | Server-Side Request Forgery            | Yes    | 0          | Clean        |

**Coverage: 10/10 categories tested**

---

## A01 — Broken Access Control

### Checks Performed

- [x] IDOR on all parameterized routes (`:systemId`, `:blobId`, `:id`)
- [x] Missing authorization middleware on protected routes
- [x] Horizontal privilege escalation (user A accessing user B's data)
- [x] Vertical privilege escalation (user accessing admin functions)
- [x] Directory traversal on file/blob operations
- [x] CORS misconfiguration allowing unauthorized origins
- [x] Missing function-level access control

### Results

**Clean.** All system routes validate ownership via `assertSystemOwnership()` using the pre-loaded `ownedSystemIds` set. RLS enforced on all ~80 database tables with `FORCE ROW LEVEL SECURITY`. Friend access uses `assertFriendAccess()` with bucket-scoped key grants and `READ ONLY` transactions. CORS explicitly validates origins (no bare `*`). Blob operations use presigned URLs with ownership validation. Unauthorized access returns 404 (not 403) to prevent resource enumeration.

---

## A02 — Cryptographic Failures

### Checks Performed

- [x] Sensitive data in plaintext (passwords, tokens, PII)
- [x] Weak hashing algorithms (MD5, SHA1 for passwords)
- [x] Hardcoded secrets/API keys in source
- [x] Missing encryption at rest / in transit
- [x] Weak random number generation for security tokens
- [x] Exposed .env files or config with secrets

### Results

**1 informational finding.** Passwords use Argon2id (OWASP-compliant parameters). Session tokens use BLAKE2b hashing. Emails are hashed with peppered BLAKE2b and encrypted with XChaCha20-Poly1305. Three-tier encryption model (E2E/server-managed/plaintext). 256-bit random tokens for sessions and API keys. Local SQLite uses AES-256 via SQLCipher. One minor memory hygiene issue with intermediate encryption key buffer (Finding 7).

---

## A03 — Injection

### Checks Performed

- [x] SQL/NoSQL injection in database queries
- [x] Command injection in shell executions
- [x] XSS (stored, reflected, DOM-based)
- [x] Template injection (SSTI)
- [x] Path injection in file operations
- [x] Header injection (CRLF)
- [x] Prototype pollution

### Results

**Clean.** All database queries use Drizzle ORM parameterization — zero raw SQL with user input. No `exec()`, `spawn()`, or `child_process` usage in application code. API returns JSON only (no HTML rendering). No template engines. Blob storage uses constructed keys (`systemId/blobId`), not user-provided paths. Structured logging prevents log injection. No dangerous `Object.assign()` or spread patterns with user-controlled keys.

---

## A04 — Insecure Design

### Checks Performed

- [x] Missing rate limiting on sensitive endpoints
- [x] No account lockout after failed login attempts
- [x] Predictable resource identifiers
- [x] Race conditions in critical operations
- [x] Missing CSRF protection on state-changing operations
- [x] Insecure direct object references in design

### Results

**3 low findings.** Rate limiting present on all endpoint categories (global, authHeavy, authLight, write, blobUpload). Account-scoped login throttling with configurable window. Resource IDs use UUIDv7 with type prefixes. CSRF not applicable (Bearer token auth, not cookies). Minor race condition in session count enforcement (Finding 3). Idempotency middleware ineffective on unauthenticated endpoints (Finding 4). Friend code expiry TOCTOU window (Finding 5).

---

## A05 — Security Misconfiguration

### Checks Performed

- [x] Debug mode enabled in production
- [x] Default credentials / admin pages exposed
- [x] Verbose error messages exposing internals
- [x] Missing security headers (CSP, HSTS, X-Content-Type-Options)
- [x] Unnecessary HTTP methods enabled
- [x] Stack traces in error responses

### Results

**Clean.** `DISABLE_RATE_LIMIT` fails in production. No admin UI or default credentials. 5xx errors masked in production (generic message, no details/stack traces). Security headers comprehensive: CSP `default-src 'self'`, HSTS 2yr with preload (prod only), X-Frame-Options DENY, Permissions-Policy (camera/mic/geo disabled), Referrer-Policy no-referrer. `Cache-Control: no-store` on auth and account routes. CORS explicitly configured, no permissive defaults.

---

## A06 — Vulnerable and Outdated Components

### Checks Performed

- [x] Known CVEs in dependencies (pnpm audit)
- [x] Outdated frameworks with security patches available
- [x] Unmaintained dependencies
- [x] Dependencies with known prototype pollution

### Results

**Clean.** `pnpm audit` reports zero known vulnerabilities. Security-conscious dependency overrides in root `package.json` (better-sqlite3-multiple-ciphers, node-forge >=1.4.0, handlebars >=4.7.9, yaml >=2.8.3, picomatch, brace-expansion). CI runs `pnpm audit --audit-level=moderate` on every build. GitHub Actions pinned to full commit SHAs (not branch tags). Container images pinned to digest hashes.

---

## A07 — Identification and Authentication Failures

### Checks Performed

- [x] Weak password policies
- [x] Missing multi-factor authentication for admin
- [x] Session fixation vulnerabilities
- [x] JWT vulnerabilities (none algorithm, weak secret, no expiry)
- [x] Insecure password reset flows
- [x] Missing session invalidation on logout/password change

### Results

**2 medium findings.** Password minimum 8 chars, max 1024 (prevents Argon2 DoS). No JWT (custom session tokens with BLAKE2b hashing). Sessions have absolute TTL + idle timeout + explicit revocation. Password change revokes all other sessions. Anti-enumeration timing on login. Login throttling per account. Session error code differentiation leaks session state (Finding 1). Unknown session type idle timeout default may not be fail-closed (Finding 2).

---

## A08 — Software and Data Integrity Failures

### Checks Performed

- [x] Missing integrity checks on CI/CD pipelines
- [x] Unsigned or unverified updates/dependencies
- [x] Insecure deserialization
- [x] Missing CSP or SRI for external scripts
- [x] Unsigned webhooks / API callbacks

### Results

**Clean.** CI/CD uses pinned action versions (full SHA, not branch tags). Container images pinned by digest. Webhook payloads HMAC-signed with per-config secrets. Optional payload encryption (XChaCha20-Poly1305). Commitlint enforces conventional commit format. Pre-push hooks validate type safety, lint, and tests. CSP set to `default-src 'self'` (no external scripts). No deserialization of untrusted data (JSON.parse on validated Zod schemas).

---

## A09 — Security Logging and Monitoring Failures

### Checks Performed

- [x] Missing audit logs for security events
- [x] No logging of failed authentication attempts
- [x] Sensitive data in logs (passwords, tokens)
- [x] Missing alerting on suspicious activity
- [x] Log injection vulnerabilities

### Results

**Clean.** 200+ audit event types covering all security-relevant operations. Failed login attempts logged at INFO level. 401/403 responses logged with request context. Structured logging (pino) prevents log injection. No string interpolation of user input in log messages. Audit log tracks IP + User-Agent (opt-in, GDPR-aware). 90-day retention with automated cleanup. Request IDs on all requests for correlation.

---

## A10 — Server-Side Request Forgery (SSRF)

### Checks Performed

- [x] Unvalidated URLs in server-side requests
- [x] DNS rebinding vulnerabilities
- [x] Missing allowlist for external service calls
- [x] Proxy/redirect endpoints without validation

### Results

**Clean.** Multi-layer SSRF protection for webhook URLs: (1) private/reserved IP blocklist (IPv4 + IPv6 + CGNAT + link-local), (2) DNS resolution validation of all resolved IPs, (3) IP pinning to prevent DNS rebinding between validation and fetch. HTTPS enforcement for non-localhost webhook URLs. No proxy or redirect endpoints. External service calls (S3, email, Valkey) use server-configured URLs, not user input.
