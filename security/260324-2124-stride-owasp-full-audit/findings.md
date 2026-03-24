# Security Findings — Pluralscape

Findings ranked by severity (descending). Each finding includes code evidence, attack scenario, and mitigation.

---

## [HIGH] Finding 1: RLS Policies Defined But Never Activated at Runtime

- **OWASP:** A01 — Broken Access Control
- **STRIDE:** Elevation of Privilege
- **Location:** `packages/db/src/rls/session.ts:19-36` (helpers exist), `apps/api/src/` (never called)
- **Confidence:** Confirmed
- **History:** New

### Description

66 Row-Level Security policies are deployed in PostgreSQL (`packages/db/migrations/pg/0001_rls_all_tables.sql`), all using `FORCE` mode. The policies reference GUC session variables (`app.current_account_id`, `app.current_system_id`). Helper functions (`setTenantContext`, `setSystemId`, `setAccountId`) exist in `packages/db/src/rls/session.ts` and are exported.

However, **none of these helpers are ever called from the API layer**. A grep for `setTenantContext|setSessionContext|withRls|withTenantContext` in `apps/api/` returns zero matches. This means RLS policies never receive tenant context and every query runs with `NULL` GUC values.

Because the policies use `NULLIF(current_setting('app.current_account_id', true), '')::varchar`, unset variables result in NULL, which matches no rows — this is **fail-closed by design**. The actual data access works because queries use Drizzle ORM's `.where(eq(table.accountId, auth.accountId))` at the application layer.

### Impact

The application-layer ownership checks (`assertSystemOwnership()`, `eq(table.systemId, auth.systemId)`) are consistently applied and appear correct. However, RLS is the critical **defense-in-depth** layer that should catch application-layer bugs. Without it activated, a single missing `WHERE` clause would expose cross-tenant data.

### Attack Scenario

1. A developer adds a new query without an ownership filter (e.g., missing `.where(eq(...))`)
2. Without RLS active, the query returns all rows across all tenants
3. Data from other accounts is exposed

### Mitigation

Add RLS context activation to service functions that perform database operations:

```typescript
import { setTenantContext } from "@pluralscape/db";

// In each service function before queries:
await setTenantContext(db, { systemId, accountId: auth.accountId });
```

Consider creating middleware that automatically sets RLS context per-request.

### References

- CWE-863: Incorrect Authorization
- CWE-284: Improper Access Control

---

## [MEDIUM] Finding 2: Fake Recovery Key Generation Has Modulo Bias

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/services/auth.service.ts:536-551`
- **Confidence:** Confirmed
- **History:** New

### Description

The `generateFakeRecoveryKey()` function (used for anti-enumeration on registration) uses `byte % chars.length` to select base32 characters. Since 256 is not evenly divisible by 32 (256 = 8 \* 32, so this is actually evenly divisible — the bias is theoretical at 0 bits), the modulo operation distributes uniformly in this case.

**Re-assessment:** After closer analysis, `256 % 32 === 0`, so there is **no modulo bias** for base32 (32 chars). This finding is downgraded.

**However**, the fake key generation differs from the real key generation algorithm: real keys use bit-level buffer extraction (5 bits per character), while fake keys use byte-level modulo. An attacker performing statistical analysis across many registration responses could potentially distinguish real vs fake keys by analyzing character distribution patterns, though the practical impact is negligible given that keys are returned once and encrypted.

### Severity: LOW (downgraded from original assessment)

---

## [MEDIUM] Finding 3: Email Enumeration via Login Throttle Timing

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/middleware/stores/account-login-store.ts` (throttle logic)
- **Confidence:** Likely
- **History:** New

### Description

The login flow implements per-account throttling. After multiple failed attempts on a **valid** email, a throttle entry is created and blocks further attempts for a cooldown period. For a **non-existent** email, no throttle entry exists.

An attacker can probe email existence by:

1. Send 10+ failed login attempts for a target email
2. Wait for the throttle window to pass
3. Try again — if throttled, the email exists (throttle entry persists); if not throttled, the email doesn't exist

### Mitigation

Store dummy throttle entries for non-existent emails to equalize behavior:

```typescript
// Even for non-existent accounts, create/update a throttle entry
// keyed on the email hash
```

### References

- CWE-203: Observable Discrepancy

---

## [MEDIUM] Finding 4: Biometric Token Replay — No Single-Use Enforcement

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/services/biometric.service.ts:89-132`
- **Confidence:** Confirmed
- **History:** New

### Description

Biometric tokens are verified by hash lookup but never marked as "used" after successful verification. The same token can be verified indefinitely within a session. Additionally, the failed-verification path lacks timing equalization (no dummy hash computation), making the endpoint vulnerable to timing-based token probing.

### Attack Scenario

1. Attacker captures a biometric verification request
2. Replays the token to authenticate without biometric prompt
3. Alternatively, brute-forces tokens using timing differences

### Mitigation

1. Add `usedAt` column to `biometric_tokens` table
2. Mark tokens as consumed after successful verification
3. Add timing equalization to the failed path (dummy hash computation)

### References

- CWE-294: Authentication Bypass by Capture-replay
- CWE-208: Observable Timing Discrepancy

---

## [MEDIUM] Finding 5: WebSocket Global Unauthed Connection Cap Without Per-IP Tracking

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/ws/ws.constants.ts:30-31`, `apps/api/src/ws/connection-manager.ts:31-39`
- **Confidence:** Confirmed
- **History:** New

### Description

The WebSocket sync endpoint has a global cap of 500 unauthenticated connections (`WS_MAX_UNAUTHED_CONNECTIONS`). This cap is global across all clients, not per-IP. An attacker can exhaust all 500 slots from a single IP, blocking legitimate users from connecting.

The auth timeout of 10 seconds means slots are eventually freed, but an attacker can sustain denial by continuously opening new connections every 10 seconds.

### Mitigation

Add per-IP tracking for unauthenticated connections:

```typescript
const PER_IP_UNAUTH_LIMIT = 50;
const ipUnauthCount = new Map<string, number>();

// In pre-upgrade check:
const clientIp = getClientIp(req);
if ((ipUnauthCount.get(clientIp) ?? 0) >= PER_IP_UNAUTH_LIMIT) {
  return new Response("Too many connections", { status: 429 });
}
```

### References

- CWE-770: Allocation of Resources Without Limits
- CWE-400: Uncontrolled Resource Consumption

---

## [MEDIUM] Finding 6: Missing Referrer-Policy and Permissions-Policy Security Headers

- **OWASP:** A05 — Security Misconfiguration
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/middleware/secure-headers.ts:15-28`
- **Confidence:** Confirmed
- **History:** Partially recurring (previous audit found no headers at all; now most are set but these two are missing)

### Description

The security headers middleware sets CSP, X-Frame-Options, X-Content-Type-Options, and HSTS (production). However, `Referrer-Policy` and `Permissions-Policy` are not configured.

- Missing `Referrer-Policy`: Request URLs (including query parameters) may leak to external sites via the Referer header
- Missing `Permissions-Policy`: Browser APIs (geolocation, camera, microphone) are not restricted

### Mitigation

```typescript
// In secure-headers.ts
headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
```

### References

- CWE-200: Exposure of Sensitive Information

---

## [MEDIUM] Finding 7: No Per-Account Session Limit

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/services/auth.service.ts` (login flow)
- **Confidence:** Confirmed
- **History:** New

### Description

There is no enforced limit on the number of active sessions per account. While individual login attempts are rate-limited (5/min via `authHeavy`), an attacker who obtains valid credentials could create sessions at the rate limit pace indefinitely, accumulating thousands of sessions per account. Each session consumes database storage and must be checked during cleanup.

### Mitigation

Add a session count check before creating new sessions:

```typescript
const sessionCount = await db
  .select({ count: count() })
  .from(sessions)
  .where(eq(sessions.accountId, accountId));

if (sessionCount >= MAX_SESSIONS_PER_ACCOUNT) {
  // Either reject or evict oldest session
}
```

### References

- CWE-770: Allocation of Resources Without Limits

---

## [MEDIUM] Finding 8: Blob Upload Idempotency Race Condition

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Tampering
- **Location:** `apps/api/src/services/blob.service.ts` (upload confirmation)
- **Confidence:** Likely
- **History:** New

### Description

Blob upload confirmation checks `uploadedAt === null` before marking a blob as uploaded. This check and the subsequent update are not in the same transaction, creating a TOCTOU race window. Two concurrent confirmation requests could both pass the null check, though the database update itself is atomic (only one succeeds).

The practical impact is low — the second request would succeed at the application layer but effectively be a no-op at the database level. However, this could lead to inconsistent audit logging.

### Mitigation

Move the null check inside the transaction:

```typescript
await db.transaction(async (tx) => {
  const [blob] = await tx
    .select()
    .from(blobs)
    .where(and(eq(blobs.id, blobId), isNull(blobs.uploadedAt)))
    .for("update");
  if (!blob) throw new BlobAlreadyConfirmedError();
  await tx.update(blobs).set({ uploadedAt: new Date() }).where(eq(blobs.id, blobId));
});
```

### References

- CWE-367: Time-of-check Time-of-use (TOCTOU)

---

## [LOW] Finding 9: Password Reset Timing Not Fully Equalized

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Location:** `apps/api/src/services/recovery-key.service.ts:260-290` (approximate)
- **Confidence:** Possible
- **History:** New

### Description

The password reset via recovery key has two failure paths: "wrong recovery key" (which includes Argon2id crypto work ~500ms) and "account not found" (which sleeps to 500ms). The difference between actual Argon2id computation and a sleep-based delay may be detectable with statistical analysis, though the practical exploitability is very low given the rate limiting on the endpoint.

### Mitigation

Apply `equalizeAntiEnumTiming()` to both failure paths to ensure identical timing behavior.

### References

- CWE-208: Observable Timing Discrepancy

---

## [LOW] Finding 10: WebSocket Envelope Signature Verification Configurable to Disabled

- **OWASP:** A08 — Software and Data Integrity Failures
- **STRIDE:** Tampering
- **Location:** `apps/api/src/ws/handlers.ts:368-371`
- **Confidence:** Confirmed
- **History:** New

### Description

Server-side envelope signature verification is enabled by default but can be disabled via environment variable for "performance tuning." If disabled and forgotten, the server accepts unsigned sync envelopes, weakening the E2E encryption integrity guarantee.

### Mitigation

Log a WARN-level message when verification is disabled. Consider removing the disable option entirely or requiring an explicit "I know what I'm doing" confirmation.

### References

- CWE-345: Insufficient Verification of Data Authenticity

---

## [LOW] Finding 11: Key Rotation Sealing Race Condition

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Repudiation
- **Location:** Bucket rotation service (key rotation sealing flow)
- **Confidence:** Likely
- **History:** New

### Description

During key rotation sealing, the `FOR UPDATE` lock is released before the content integrity tag is fully checked. This can cause duplicate audit events if two concurrent sealing requests are processed. The data integrity is maintained, but the audit trail may contain duplicates.

### Mitigation

Extend the `FOR UPDATE` lock to cover the full sealing phase, or add a state guard on the final UPDATE.

---

## [LOW] Finding 12: Webhook Deletion TOCTOU

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Tampering
- **Location:** Webhook config service (delete flow)
- **Confidence:** Likely
- **History:** New

### Description

Webhook config deletion checks for pending deliveries before deletion. The check and the delete are not in the same transaction. If a delivery completes between the check and the delete, the user sees a confusing error (FK constraint violation) instead of the expected "has pending deliveries" error. Data integrity is preserved by the FK `onDelete: "restrict"` constraint.

### Mitigation

Move the pending delivery count check inside the deletion transaction with `FOR UPDATE`.

---

## [INFO] Finding 13: CodeQL Enabled via GitHub Default Setup (Not a Finding)

- **Status:** Not a finding — CodeQL IS active
- **Evidence:** GitHub API confirms CodeQL analyses running on every PR and main push since 2026-03-09
- **Note:** CodeQL is configured via GitHub's default code scanning setup rather than a workflow file in the repo, which is why it was initially flagged. The `pnpm codeql` script provides local analysis capability in addition to CI.
