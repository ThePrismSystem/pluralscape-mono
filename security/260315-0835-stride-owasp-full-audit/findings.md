# Security Findings — Pluralscape

Findings ranked by severity (descending). Each finding includes code evidence, attack scenario, and mitigation.

---

## [HIGH] Finding 1: No Authentication or Authorization Middleware

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Elevation of Privilege
- **Location:** `apps/api/src/index.ts:1-21`
- **Confidence:** Confirmed

### Description

The Hono API application has no authentication or authorization middleware. The only middleware is `requireSelfHosted` (deployment guard), which is not currently applied to any route. When API endpoints are added (tRPC routers, CRUD operations), they will be accessible without authentication unless auth middleware is implemented first.

### Code Evidence

```typescript
// apps/api/src/index.ts — entire file
import { Hono } from "hono";

const DEFAULT_PORT = 10045;
const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

const app = new Hono();

app.get("/", (c) => {
  return c.json({ status: "ok", service: "pluralscape-api" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

Bun.serve({ port, fetch: app.fetch });
```

No `app.use()` calls for auth, CORS, rate limiting, or security headers.

### Attack Scenario

1. Developer adds a new route (e.g., `POST /api/systems`) without auth middleware
2. Unauthenticated HTTP request reaches the handler
3. Handler executes DB queries without tenant context
4. Data exposure or modification without authorization

### Mitigation

```typescript
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

// Apply global middleware BEFORE route definitions
app.use("*", cors({ origin: ["https://your-domain.com"] }));
app.use("*", secureHeaders());
app.use("/api/*", authMiddleware); // verify session/JWT/API key
app.use("/api/*", rateLimiter({ windowMs: 60_000, max: 100 }));
```

### References

- CWE-306: Missing Authentication for Critical Function
- CWE-862: Missing Authorization

---

## [MEDIUM] Finding 2: No Security Headers

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/index.ts:6`
- **Confidence:** Confirmed

### Description

The Hono application does not configure any security response headers. Missing headers include CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Permissions-Policy.

### Mitigation

```typescript
import { secureHeaders } from "hono/secure-headers";

app.use("*", secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'self'"] },
  strictTransportSecurity: "max-age=63072000; includeSubDomains",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
}));
```

### References

- CWE-693: Protection Mechanism Failure

---

## [MEDIUM] Finding 3: No Rate Limiting

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/index.ts:6`
- **Confidence:** Confirmed

### Description

No rate limiting middleware is configured. Critical for authentication endpoints (login, password reset, device transfer) which are computationally expensive (Argon2id) and brute-force targets.

### Attack Scenario

1. Attacker sends rapid login requests with different passwords
2. Each triggers Argon2id (2-3 ops, 32-64 MiB) on the server
3. CPU and memory exhaustion, denying service to legitimate users

### Mitigation

Use Hono's rate limiter or a Redis-backed solution:

```typescript
app.use("/api/auth/*", rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "unknown",
}));
```

### References

- CWE-770: Allocation of Resources Without Limits

---

## [MEDIUM] Finding 4: No CORS Configuration

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/index.ts:6`
- **Confidence:** Confirmed

### Description

No CORS middleware is configured. The Hono app will accept requests from any origin by default. When API endpoints are added, cross-origin requests from malicious sites could access authenticated endpoints.

### Mitigation

```typescript
import { cors } from "hono/cors";

app.use("*", cors({
  origin: ["https://your-domain.com"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
```

### References

- CWE-942: Overly Permissive Cross-domain Whitelist

---

## [MEDIUM] Finding 5: SQLite Foreign Keys Not Enforced

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Tampering
- **Location:** `packages/db/src/client/factory.ts:57-69`
- **Confidence:** Confirmed

### Description

The `createDatabase()` factory for SQLite sets `journal_mode = WAL` and optionally configures SQLCipher encryption, but does not enable `PRAGMA foreign_keys = ON`. Without this pragma, SQLite ignores all foreign key constraints, allowing orphaned records and referential integrity violations. Tests explicitly set this pragma, masking the issue.

### Code Evidence

```typescript
// packages/db/src/client/factory.ts:57-69
const client = new Database(config.filename);
try {
  if (config.encryptionKey) {
    client.pragma(`cipher='sqlcipher'`);
    client.pragma(`key="x'${config.encryptionKey}'"`);
  }
  client.pragma("journal_mode = WAL");
  // Missing: client.pragma("foreign_keys = ON");
} catch (err) {
  client.close();
  throw err;
}
```

### Attack Scenario

1. Application creates a member record with a non-existent systemId
2. SQLite accepts the insert (FK not enforced)
3. Member exists without a parent system, breaking data integrity
4. In multi-system scenarios, could lead to data leaking between systems

### Mitigation

```typescript
client.pragma("foreign_keys = ON");
```

Add this line after WAL mode setup, before returning the client.

### References

- CWE-20: Improper Input Validation

---

## [MEDIUM] Finding 6: No Password Complexity Enforcement

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `packages/crypto/src/master-key-wrap.ts:37-39`
- **Confidence:** Confirmed

### Description

The `derivePasswordKey()` function only validates that the password is non-empty. No minimum length, character diversity, or password policy is enforced at the crypto layer. While enforcement could happen at the application layer, no such enforcement exists anywhere in the codebase.

### Code Evidence

```typescript
// packages/crypto/src/master-key-wrap.ts:37-39
export function derivePasswordKey(password: string, salt: PwhashSalt, profile: PwhashProfile): Promise<AeadKey> {
  if (password.length === 0) {
    throw new InvalidInputError("Password must not be empty.");
  }
  // No length/complexity check — "a" is a valid password
```

### Mitigation

Enforce at the application layer (not crypto):

```typescript
function validatePasswordPolicy(password: string): void {
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  // Consider zxcvbn for strength estimation
}
```

### References

- CWE-521: Weak Password Requirements

---

## [MEDIUM] Finding 7: Webhook Secret Stored as T3 (Server-Readable)

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/webhooks.ts` (webhookConfigs.secret column)
- **Confidence:** Confirmed

### Description

Webhook HMAC signing secrets are stored as `binary` columns without E2E encryption (T3 tier — server-readable). If the database is compromised, an attacker can read all webhook secrets and forge HMAC signatures for webhook payloads, potentially injecting fake events into downstream systems.

### Mitigation

This is a design trade-off: the server must read webhook secrets to sign outgoing deliveries, so E2E encryption is not possible for this field. Mitigations:

1. Encrypt at rest via database-level encryption (PG TDE, SQLCipher)
2. Rotate webhook secrets periodically
3. Allow users to verify webhook signatures with a test endpoint

### References

- CWE-312: Cleartext Storage of Sensitive Information

---

## [MEDIUM] Finding 8: No Global Error Handler

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/index.ts:6`
- **Confidence:** Confirmed

### Description

The Hono app has no global error handler (`.onError()`). Unhandled exceptions will produce default error responses that may include stack traces, internal module paths, or sensitive error messages in production.

### Mitigation

```typescript
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
```

### References

- CWE-209: Generation of Error Message Containing Sensitive Information

---

## [LOW] Finding 9: Transfer Code Entropy

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Spoofing
- **Location:** `packages/crypto/src/device-transfer.ts:12-13`
- **Confidence:** Likely

### Description

The device transfer code uses 8 decimal digits (~26.5 bits of entropy). While protected by Argon2id with the "mobile" profile (2 ops, 32 MiB) and a 5-minute session timeout, an attacker who captures the salt could attempt offline brute force. At ~1ms per Argon2id hash on a modern GPU, the full keyspace could be exhausted in ~28 hours. The code comments acknowledge this trade-off.

### Mitigation

The 5-minute timeout effectively prevents online brute force. For higher security:
- Increase to 10-12 digits (adds ~7-13 bits)
- Use the "server" profile (3 ops, 64 MiB) for the transfer KDF
- Add attempt limiting on the server relay

### References

- CWE-330: Use of Insufficiently Random Values

---

## [LOW] Finding 10: Audit Log PII in Plaintext

- **OWASP:** A09 — Security Logging & Monitoring Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/audit-log.ts` (ipAddress, userAgent columns)
- **Confidence:** Confirmed

### Description

The audit log stores IP addresses and user agent strings as plaintext varchar columns. These are GDPR personal data. While the schema comments mention retention policies and the code references ADR 017, no schema-level enforcement (e.g., TTL column, auto-expiry) exists. Retention must be enforced at the application layer.

### Mitigation

The audit-log cleanup query functions exist in `packages/db/src/queries/audit-log-cleanup.ts`. Ensure they are scheduled to run regularly via the job queue.

### References

- CWE-532: Insertion of Sensitive Information into Log File

---

## [INFO] Positive Findings

The following areas were tested and found to be well-implemented:

| Area | Finding | Location |
|------|---------|----------|
| Dependencies | 0 known CVEs across 976 packages | pnpm audit |
| SQL Injection | Drizzle ORM parameterized queries throughout; RLS uses set_config() | All query code |
| Command Injection | No exec/spawn calls in production code | All source files |
| Prototype Pollution | No __proto__ or prototype manipulation | All source files |
| XSS | No dangerouslySetInnerHTML, innerHTML, or eval in production | All source files |
| RLS Fail-Closed | NULLIF(current_setting(..., true), '') prevents leaks on unset vars | `packages/db/src/rls/policies.ts:17-19` |
| Key Zeroing | All key derivation functions memzero in finally blocks | All crypto modules |
| Sync Integrity | AEAD + Ed25519 signatures on all sync envelopes | `packages/sync/src/encrypted-sync.ts` |
| Encryption Algorithms | XChaCha20-Poly1305 (AEAD), Ed25519, Argon2id — all modern, well-chosen | `packages/crypto/` |
| Key Derivation | KEK/DEK pattern, deterministic identity from master key, isolated KDF contexts | `packages/crypto/src/master-key-wrap.ts`, `identity.ts` |
| Stream Encryption | Chunk AAD prevents reordering/truncation attacks | `packages/crypto/src/symmetric.ts:64-70` |
| Key Grants | Authenticated envelope encryption binds bucketId + keyVersion | `packages/crypto/src/key-grants.ts` |
| SSRF | No outbound HTTP requests in production code | All source files |
