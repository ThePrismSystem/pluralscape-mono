# OWASP Top 10 Coverage — Pluralscape Audit 2026-03-24

## Coverage Matrix

| ID  | Category                       | Tested | Findings | Status                                                           |
| --- | ------------------------------ | ------ | -------- | ---------------------------------------------------------------- |
| A01 | Broken Access Control          | Yes    | 1        | ⚠️ RLS not activated (defense-in-depth gap)                      |
| A02 | Cryptographic Failures         | Yes    | 0        | ✅ Strong (XChaCha20, Ed25519, Argon2id, proper key mgmt)        |
| A03 | Injection                      | Yes    | 0        | ✅ Clean (Drizzle ORM, no raw SQL, no command injection)         |
| A04 | Insecure Design                | Yes    | 4        | ⚠️ Race conditions, session limits, WS connection cap            |
| A05 | Security Misconfiguration      | Yes    | 1        | ⚠️ Missing Referrer-Policy + Permissions-Policy                  |
| A06 | Vulnerable Components          | Yes    | 0        | ✅ Clean (0 CVEs, pnpm audit clean, Renovate active)             |
| A07 | Auth & Identification Failures | Yes    | 3        | ⚠️ Timing enumeration, biometric replay, reset timing            |
| A08 | Software & Data Integrity      | Yes    | 2        | ⚠️ Envelope verification toggle, CodeQL not in CI                |
| A09 | Security Logging & Monitoring  | Yes    | 0        | ✅ Strong (80+ event types, structured Pino logging, opt-in PII) |
| A10 | Server-Side Request Forgery    | Yes    | 0        | ✅ Clean (comprehensive IP range blocking, DNS re-validation)    |

**Coverage: 10/10 categories tested**

---

## Per-Category Detail

### A01 — Broken Access Control

**Checks performed:**

- [x] IDOR on all parameterized routes (`:systemId`, `:memberId`, `:blobId`, etc.)
- [x] Authorization middleware on protected routes
- [x] Horizontal privilege escalation (cross-account access)
- [x] Vertical privilege escalation (no admin endpoints exist)
- [x] Directory traversal on file operations
- [x] CORS misconfiguration
- [x] Function-level access control
- [x] RLS policy activation

**Result:** Application-layer ownership checks are comprehensive and consistently applied via `assertSystemOwnership()`. RLS policies exist but are not activated at runtime (defense-in-depth gap). No IDOR vulnerabilities found at the application layer.

### A02 — Cryptographic Failures

**Checks performed:**

- [x] Sensitive data encryption (E2E with libsodium)
- [x] Hashing algorithms (Argon2id, BLAKE2b — no MD5/SHA1 for passwords)
- [x] Hardcoded secrets (none found)
- [x] Encryption at rest (SQLCipher optional, S3 encrypted)
- [x] Random number generation (libsodium randombytes, no Math.random)
- [x] Key management (KEK/DEK, proper zeroing, rotation support)
- [x] Nonce handling (fresh per encryption, correct sizes)

**Result:** Cryptographic implementation is excellent. Proper algorithm choices, key lifecycle management, memory zeroing, and nonce handling. Recovery key and device transfer use uniform random generation.

### A03 — Injection

**Checks performed:**

- [x] SQL injection (Drizzle ORM parameterization throughout)
- [x] Command injection (no child_process/exec/spawn in API)
- [x] XSS (API-only, no HTML rendering)
- [x] Path injection (blob storage uses branded type-safe keys)
- [x] Header injection (no user input in headers)
- [x] Log injection (Pino structured logging)
- [x] Template injection (no template engines)
- [x] ReDoS (simple regex patterns only)

**Result:** No injection vectors found. Drizzle ORM prevents SQL injection, Pino prevents log injection, and blob storage keys are constructed from validated IDs only.

### A04 — Insecure Design

**Checks performed:**

- [x] Rate limiting (15 categories, comprehensive coverage)
- [x] Account lockout (login throttling implemented)
- [x] Predictable resource identifiers (UUIDs throughout)
- [x] Race conditions (4 moderate findings)
- [x] CSRF (Bearer token auth, not cookie-based)
- [x] Session limits (no per-account limit)

**Result:** Rate limiting is strong. Four race condition issues found (blob upload, key rotation sealing, webhook deletion, session creation limit).

### A05 — Security Misconfiguration

**Checks performed:**

- [x] Debug mode (production masking enforced)
- [x] Default credentials (test containers only)
- [x] Error messages (masked in production)
- [x] Security headers (CSP, HSTS, X-Frame-Options set; Referrer-Policy, Permissions-Policy missing)
- [x] CORS (strict, no wildcard)
- [x] Rate limit bypass (TRUST_PROXY handled correctly)
- [x] Stack traces (masked in production)

**Result:** One finding: missing Referrer-Policy and Permissions-Policy headers. All other security configuration is solid.

### A06 — Vulnerable and Outdated Components

**Checks performed:**

- [x] `pnpm audit` (0 known CVEs)
- [x] Outdated frameworks (all actively maintained)
- [x] Unmaintained dependencies (none found)
- [x] Prototype pollution susceptible deps (none found)
- [x] Security-conscious pnpm overrides (applied for transitive deps)

**Result:** Clean dependency posture. Renovate automates updates with SHA-pinned GitHub Actions.

### A07 — Identification and Authentication Failures

**Checks performed:**

- [x] Password policy (12-256 chars enforced via Zod)
- [x] Session management (hash-only storage, absolute + idle timeouts)
- [x] JWT (not used — session tokens instead)
- [x] Password reset (recovery key based, rate-limited)
- [x] Session invalidation on password change (confirmed)
- [x] Anti-enumeration timing (implemented but with gaps)
- [x] Biometric token handling (replay vulnerability)

**Result:** Three findings: login throttle timing enumeration, biometric token replay, password reset timing gap. Core auth is solid with hash-only token storage and proper session lifecycle.

### A08 — Software and Data Integrity Failures

**Checks performed:**

- [x] CI/CD integrity (SHA-pinned actions, frozen lockfile)
- [x] Dependency verification (pnpm audit in CI)
- [x] Webhook signing (HMAC-SHA256 with timestamp)
- [x] Sync data integrity (Ed25519 signatures + AEAD)
- [x] CSP (set with frame-ancestors: none)
- [x] CodeQL integration (active via GitHub default setup, runs on every PR)

**Result:** Envelope signature verification is configurable to disabled (low risk, default secure). CodeQL not in CI pipeline.

### A09 — Security Logging and Monitoring

**Checks performed:**

- [x] Audit logs for security events (80+ event types)
- [x] Failed auth logging (tracked via audit events)
- [x] Sensitive data in logs (none — Pino structured)
- [x] Log injection (prevented by structured logging)
- [x] IP/UA tracking (opt-in per ADR 028)

**Result:** Strong logging posture. Comprehensive audit event taxonomy with privacy-preserving defaults.

### A10 — Server-Side Request Forgery

**Checks performed:**

- [x] Webhook URL validation (HTTPS enforced in production)
- [x] DNS resolution + IP blocking (private ranges, loopback, link-local all blocked)
- [x] Delivery-time re-validation (prevents DNS rebinding)
- [x] No unvalidated outbound HTTP in API code

**Result:** Comprehensive SSRF protection with re-validation at delivery time.
