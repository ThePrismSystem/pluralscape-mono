# Security Findings — Pluralscape

Findings ranked by severity (descending). Each finding includes code evidence, attack scenario, and mitigation.

---

## [MEDIUM] Finding 1: ZodError Details Leak in Production Responses

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/middleware/error-handler.ts:84-92`
- **Confidence:** Confirmed
- **History:** New

### Description

The global error handler passes the full ZodError object as `details` in 400 responses. Production masking only applies to 5xx errors (line 51: `status >= HTTP_INTERNAL_SERVER_ERROR`). This means ZodError details — including field names, type constraints, and validation rules — are returned to clients even in production.

### Code Evidence

```typescript
// apps/api/src/middleware/error-handler.ts:82-93
if (err instanceof Error && err.name === "ZodError") {
  return formatError(
    c,
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "Validation failed",
    requestId,
    isProduction,
    err,  // ← Full ZodError object passed as details
  );
}

// Line 51-56 — masking logic:
const mask = isProduction && status >= HTTP_INTERNAL_SERVER_ERROR;
// For 400 (ZodError), mask = false → details are included in response
```

### Attack Scenario

1. Attacker sends malformed JSON to any validated endpoint (e.g., `POST /auth/register` with `{"email": 123}`)
2. ZodError response reveals: `"expected": "string"`, field paths, min/max constraints
3. Attacker maps all validation schemas without access to source code
4. Knowledge of field names and constraints aids targeted attacks on other vectors

### Mitigation

Strip ZodError details in production, or return only field paths without constraint metadata:

```typescript
if (err instanceof Error && err.name === "ZodError") {
  const details = isProduction ? undefined : err;
  return formatError(c, HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", requestId, isProduction, details);
}
```

### References

- CWE-209: Generation of Error Message Containing Sensitive Information

---

## [MEDIUM] Finding 2: Unbounded encryptedData String in System Update Schema

- **OWASP:** A03 — Injection (resource exhaustion via oversized input)
- **STRIDE:** Tampering
- **Location:** `packages/validation/src/system.ts:5`
- **Confidence:** Confirmed
- **History:** New

### Description

The `UpdateSystemBodySchema` defines `encryptedData: z.string().min(1)` with no `.max()` constraint. While the global body limit (256 KiB) prevents extremely large payloads, a single field could consume most of that budget. Per-field validation would catch oversized encrypted payloads earlier in the pipeline and provide clearer error messages. More critically, if body limits are ever raised for other endpoints (e.g., file uploads), this field remains unprotected.

### Code Evidence

```typescript
// packages/validation/src/system.ts:3-8
export const UpdateSystemBodySchema = z
  .object({
    encryptedData: z.string().min(1),  // ← No .max() constraint
    version: z.int().min(1),
  })
  .readonly();
```

### Attack Scenario

1. Attacker sends `PUT /systems/:id` with `encryptedData` containing 200KB of base64 junk
2. Request passes body limit (256KB total)
3. Zod parses the string, service layer processes it, attempts DB write
4. Unnecessarily large payloads waste CPU, memory, and storage

### Mitigation

Add a reasonable `.max()` bound aligned with actual encrypted payload sizes:

```typescript
encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
```

### References

- CWE-400: Uncontrolled Resource Consumption

---

## [MEDIUM] Finding 3: Session Revocation TOCTOU (Defense-in-Depth Gap)

- **OWASP:** A01 — Broken Access Control
- **STRIDE:** Elevation of Privilege
- **Location:** `apps/api/src/services/auth.service.ts:349-364`
- **Confidence:** Confirmed (gap exists; not directly exploitable)
- **History:** New

### Description

The `revokeSession()` function performs an ownership check (line 351) outside the database transaction, then executes the UPDATE (line 363) inside the transaction filtering only by `sessions.id`. The `accountId` from the ownership check is not re-verified in the WHERE clause of the UPDATE statement.

While `accountId` on sessions is immutable (set at creation, never updated), this pattern violates defense-in-depth. If a future schema change or bug allows session reassignment, the ownership check would be bypassable.

### Code Evidence

```typescript
// apps/api/src/services/auth.service.ts:349-375
export async function revokeSession(db, sessionId, actorAccountId, audit) {
  // Ownership check OUTSIDE transaction
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (session?.accountId !== actorAccountId) return false;  // ← line 351
  if (session.revoked) return false;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(eq(sessions.id, sessionId))  // ← line 363: only sessionId, no accountId
      .returning({ id: sessions.id });
    // ...
  });
}
```

### Mitigation

Include `accountId` in the transaction's WHERE clause:

```typescript
.where(and(eq(sessions.id, sessionId), eq(sessions.accountId, actorAccountId)))
```

### References

- CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition

---

## [LOW] Finding 4: X-Forwarded-For Not Validated as IP Format

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/middleware/rate-limit.ts:36`, `apps/api/src/lib/request-meta.ts:19`
- **Confidence:** Confirmed
- **History:** New

### Description

When `TRUST_PROXY=1`, the rate limiter and request-meta extractor accept the first comma-separated value from `X-Forwarded-For` without validating it as a syntactically valid IP address. An attacker can inject arbitrary strings (e.g., `"not-an-ip"`, empty padded strings, or extremely long values) to create unlimited rate-limit buckets.

### Code Evidence

```typescript
// apps/api/src/middleware/rate-limit.ts:35-37
const forwarded = c.req.header("x-forwarded-for");
const ip = forwarded?.split(",")[0]?.trim();
return ip && ip.length > 0 ? ip : GLOBAL_KEY;  // ← No IP format validation
```

### Attack Scenario

1. Attacker sends requests with unique `X-Forwarded-For` values: `fake-1`, `fake-2`, etc.
2. Each creates a new entry in the rate-limit `Map`
3. After 10,000 entries, eviction runs — but attacker can keep flooding with new keys
4. Legitimate IP entries may be evicted during cleanup window

### Mitigation

Validate the extracted value as a valid IPv4 or IPv6 address:

```typescript
function isValidIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(":");
}

const ip = forwarded?.split(",")[0]?.trim();
return ip && isValidIp(ip) ? ip : GLOBAL_KEY;
```

### References

- CWE-345: Insufficient Verification of Data Authenticity

---

## [LOW] Finding 5: Password Validation Schema Inconsistency

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `packages/validation/src/auth.ts:9,17`
- **Confidence:** Confirmed
- **History:** Recurring (partially addressed since last audit)

### Description

The `LoginCredentialsSchema` and `RegistrationInputSchema` use `z.string().min(1)` for the password field, while the auth service enforces `AUTH_MIN_PASSWORD_LENGTH` (8 characters) at registration time (`auth.service.ts:63-67`). Only `ChangePasswordSchema` enforces the minimum at the schema level.

For login, `min(1)` is intentionally correct — you can't enforce password policy on existing passwords. For registration, the schema and service should be consistent to prevent bypasses if the service-level check is ever removed.

### Code Evidence

```typescript
// packages/validation/src/auth.ts:5-11
export const LoginCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),  // ← Intentionally min(1) for login
});

// packages/validation/src/auth.ts:13-21
export const RegistrationInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),  // ← Should be min(AUTH_MIN_PASSWORD_LENGTH)
  // ...
});
```

### Mitigation

Enforce `AUTH_MIN_PASSWORD_LENGTH` in `RegistrationInputSchema`:

```typescript
export const RegistrationInputSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH_MIN_PASSWORD_LENGTH),
  // ...
});
```

### References

- CWE-521: Weak Password Requirements

---

## [LOW] Finding 6: Webhook HMAC Secrets Stored Server-Readable (T3)

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/webhooks.ts`
- **Confidence:** Confirmed
- **History:** Recurring (unchanged from previous audit)

### Description

Webhook signing secrets are stored as binary columns without E2E encryption. This is a necessary design trade-off — the server must read secrets to sign outgoing webhook payloads. If the database is compromised, an attacker can forge HMAC signatures.

### Mitigation

- Database-level encryption at rest (PG TDE, SQLCipher) provides protection
- Periodic secret rotation
- User-facing webhook signature verification test endpoint

### References

- CWE-312: Cleartext Storage of Sensitive Information

---

## [LOW] Finding 7: Audit Log PII in Plaintext

- **OWASP:** A09 — Security Logging & Monitoring Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/audit-log.ts`
- **Confidence:** Confirmed
- **History:** Recurring (unchanged from previous audit)

### Description

IP addresses and user agent strings are stored as plaintext in the audit log. These are GDPR personal data. Cleanup queries exist in `packages/db/src/queries/audit-log-cleanup.ts` but their scheduled execution via the job queue has not been verified.

### Mitigation

Ensure audit log cleanup is scheduled via BullMQ job queue with appropriate retention periods.

### References

- CWE-532: Insertion of Sensitive Information into Log File

---

## [LOW] Finding 8: Device Transfer Code Entropy

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Spoofing
- **Location:** `packages/crypto/src/device-transfer.ts:12-13`
- **Confidence:** Likely
- **History:** Recurring (unchanged, accepted trade-off)

### Description

Device transfer uses 8 decimal digits (~26.5 bits entropy). Protected by Argon2id mobile profile and 5-minute timeout, but offline brute-force of the full keyspace is feasible in ~28 hours on modern GPUs if the salt is captured.

### References

- CWE-330: Use of Insufficiently Random Values

---

## [INFO] Positive Findings

The following areas were tested and found well-implemented:

| Area | Finding | Location |
|------|---------|----------|
| Auth Middleware | Full implementation: Bearer token, session validation, idle/absolute timeout, revocation check | `apps/api/src/middleware/auth.ts` |
| Security Headers | CSP, X-Frame-Options: DENY, HSTS (production) | `apps/api/src/middleware/secure-headers.ts` |
| Rate Limiting | Global + per-category (authHeavy, authLight, write); proper 429 responses with headers | `apps/api/src/middleware/rate-limit.ts` |
| CORS | Configurable via CORS_ORIGIN env var; locked down to specified origins | `apps/api/src/middleware/cors.ts` |
| Error Handler | Global handler with production masking on 5xx; structured responses | `apps/api/src/middleware/error-handler.ts` |
| SQLite FK | PRAGMA foreign_keys = ON now enabled in factory | `packages/db/src/client/factory.ts:65` |
| SQL Injection | Drizzle ORM parameterized queries throughout; RLS uses set_config() | All query code |
| Command Injection | No exec/spawn calls in production code | All source files |
| XSS | No dangerouslySetInnerHTML, innerHTML, or eval | All source files |
| SSRF | No outbound HTTP requests in production code | All source files |
| Prototype Pollution | No __proto__ or prototype manipulation | All source files |
| Dependencies | 0 known CVEs across all packages | `pnpm audit` |
| RLS Fail-Closed | NULLIF(current_setting(..., true), '') prevents leaks | `packages/db/src/rls/policies.ts:17-19` |
| Key Zeroing | All key derivation memzero in finally blocks | All crypto modules |
| Encryption | XChaCha20-Poly1305 AEAD, Ed25519, Argon2id — modern, well-chosen | `packages/crypto/` |
| KEK/DEK Pattern | Master key survives password reset via envelope encryption | `packages/crypto/src/master-key-wrap.ts` |
| Stream Encryption | Chunk AAD prevents reordering/truncation | `packages/crypto/src/symmetric.ts:64-70` |
| Key Grants | Authenticated envelope binds bucketId + keyVersion | `packages/crypto/src/key-grants.ts` |
| Anti-Timing (Login) | Dummy Argon2id hash for non-existent accounts | `apps/api/src/services/auth.service.ts:227` |
| Anti-Enumeration (Register) | Fake recovery key + timing delay | `apps/api/src/services/auth.service.ts:177-188` |
| Path Traversal | Multi-layer defense: ".." check + resolve + startsWith guard | `packages/storage/src/adapters/filesystem/filesystem-adapter.ts:169-182` |
| Password Change | Re-wraps master key, revokes all other sessions | `apps/api/src/services/account.service.ts:222-250` |
| Concurrency Control | Version field with optimistic locking on account updates | `apps/api/src/services/account.service.ts:232` |
| IDOR Protection | All system/session queries scoped to auth.accountId | All service files |
| Pagination | Cursor-based keyset with account scoping and limit caps | System and session list queries |
