# Security Findings — Pluralscape

Findings ranked by severity (descending). Each finding includes code evidence, attack scenario, and mitigation.

---

## [MEDIUM] Finding 1: Login Timing Side-Channel via Audit Write

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/services/auth.service.ts:225-244`
- **Confidence:** Confirmed
- **History:** New

### Description

The login function has asymmetric timing between the "user not found" and "invalid password" paths. Both paths call `verifyPassword` (Argon2id), but only the invalid-password path performs an audit log INSERT. This creates a measurable timing difference that can be used for email enumeration via statistical analysis over many requests.

### Code Evidence

```typescript
// apps/api/src/services/auth.service.ts:225-244
if (!account) {
  // Anti-timing: run verification against dummy hash to equalize timing
  verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
  return null; // <-- Returns immediately after Argon2id
}

const valid = verifyPassword(account.passwordHash, parsed.password);
if (!valid) {
  try {
    await audit(db, {
      // <-- Additional DB write adds ~1-5ms
      eventType: "auth.login-failed",
      actor: { kind: "account", id: account.id },
      detail: "Invalid password",
      accountId: account.id as AccountId,
    });
  } catch (auditError: unknown) {
    console.error("[audit] Failed to write auth.login-failed:", auditError);
  }
  return null;
}
```

### Attack Scenario

1. Attacker sends login requests with candidate emails and wrong passwords
2. "Not found" path: Argon2id (~500ms) + return
3. "Invalid password" path: Argon2id (~500ms) + audit INSERT (~1-5ms) + return
4. Over hundreds of requests (rate limit allows 5/min), statistical analysis reveals the ~1-5ms delta
5. Attacker can distinguish valid from invalid email addresses

### Mitigation

Add a dummy audit write to the "not found" path, or move audit writes to a fire-and-forget background job:

```typescript
if (!account) {
  verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
  // Match the timing of the "invalid password" path:
  void audit(db, { eventType: "auth.login-failed", ... }).catch(() => {});
  return null;
}
```

### References

- CWE-208: Observable Timing Discrepancy

---

## [MEDIUM] Finding 2: Password Reset Path Differentiation

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/services/recovery-key.service.ts:212-236`
- **Confidence:** Likely
- **History:** New

### Description

The `resetPasswordWithRecoveryKey` function has three distinct paths: "no account" (returns null at line 220), "no recovery key" (throws `NoActiveRecoveryKeyError` at line 236), and "wrong key" (throws `DecryptionFailedError`). While all three are caught by the route handler and converted to the same 401 response, the different exception handling paths could create subtle timing differences. Additionally, the "no account" path does dummy Argon2id work while the "no recovery key" path does not — a significant timing difference.

### Code Evidence

```typescript
// apps/api/src/services/recovery-key.service.ts:212-236
if (!account) {
  // Does dummy Argon2id + timing equalization
  verifyPassword(DUMMY_ARGON2_HASH, parsed.newPassword);
  await equalizeAntiEnumTiming(startTime);
  return null;  // <-- Route handler converts to 401
}

// ... fetch recovery key ...

if (!activeKey) {
  // Only timing equalization, NO dummy Argon2id
  await equalizeAntiEnumTiming(startTime);
  throw new NoActiveRecoveryKeyError(...);  // <-- Route catches, converts to 401
}
```

### Attack Scenario

1. Attacker targets a known valid email (from Finding 1 or other means)
2. Sends recovery key requests with wrong keys
3. Compares timing of "no account" (Argon2id + timing + null path) vs "valid account, wrong key" (crypto decrypt + timing + exception path)
4. Could confirm whether an account has an active recovery key

### Mitigation

Ensure all error paths perform equivalent work. Add dummy Argon2id to the "no recovery key" path:

```typescript
if (!activeKey) {
  try { verifyPassword(DUMMY_ARGON2_HASH, parsed.newPassword); } catch {}
  await equalizeAntiEnumTiming(startTime);
  throw new NoActiveRecoveryKeyError(...);
}
```

### References

- CWE-208: Observable Timing Discrepancy

---

## [MEDIUM] Finding 3: Registration and Change-Password Schemas Missing Password Max Length

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `packages/validation/src/auth.ts:20,36`
- **Confidence:** Confirmed
- **History:** New

### Description

`RegistrationInputSchema` (line 20) and `ChangePasswordSchema` (line 36) enforce `min(AUTH_MIN_PASSWORD_LENGTH)` but lack `.max(MAX_PASSWORD_LENGTH)`. The `PasswordResetViaRecoveryKeySchema` (line 51) correctly has both bounds. While the 256 KiB body limit caps total request size, a password consuming most of that budget (~200KB) would still be processed by Argon2id, wasting CPU/memory.

### Code Evidence

```typescript
// packages/validation/src/auth.ts:17-24
export const RegistrationInputSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH_MIN_PASSWORD_LENGTH), // <-- Missing .max(MAX_PASSWORD_LENGTH)
  // ...
});

// Line 33-38
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH), // <-- Missing .max(MAX_PASSWORD_LENGTH)
});

// Line 47-53 — correct:
export const PasswordResetViaRecoveryKeySchema = z.object({
  // ...
  newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});
```

### Mitigation

Add `.max(MAX_PASSWORD_LENGTH)` to `RegistrationInputSchema.password` and `ChangePasswordSchema.newPassword` for consistency:

```typescript
password: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
```

### References

- CWE-400: Uncontrolled Resource Consumption

---

## [LOW] Finding 4: Session Revocation Pre-Transaction Check is Dead Code

- **OWASP:** A01 — Broken Access Control
- **STRIDE:** Elevation of Privilege
- **Location:** `apps/api/src/services/auth.service.ts:352-356`
- **Confidence:** Confirmed
- **History:** Recurring (improved from previous audit)

### Description

The `revokeSession` function performs a pre-transaction ownership check (line 352-356) outside the transaction, then the transaction's WHERE clause includes `accountId` (line 362). The pre-transaction check is now redundant — the transaction WHERE clause is authoritative. The pre-transaction check creates a minor TOCTOU window where a session could be revoked between the check and the transaction, causing the transaction to return 0 rows and log a misleading "cross-account" warning.

### Code Evidence

```typescript
// apps/api/src/services/auth.service.ts:352-380
const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

if (!session || session.revoked) {
  return false;  // <-- Pre-transaction check (redundant)
}

return db.transaction(async (tx) => {
  const updated = await tx
    .update(sessions)
    .set({ revoked: true })
    .where(and(eq(sessions.id, sessionId), eq(sessions.accountId, actorAccountId)))
    // ^-- This WHERE clause is the real guard
    .returning({ id: sessions.id });
```

### Mitigation

Remove the pre-transaction check and fold `revoked = false` into the transaction WHERE:

```typescript
return db.transaction(async (tx) => {
  const updated = await tx
    .update(sessions)
    .set({ revoked: true })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.accountId, actorAccountId),
        eq(sessions.revoked, false),
      ),
    )
    .returning({ id: sessions.id });

  if (updated.length === 0) return false;
  // ... audit ...
});
```

### References

- CWE-367: TOCTOU Race Condition

---

## [LOW] Finding 5: Webhook HMAC Secrets Stored Server-Readable (T3)

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/webhooks.ts`
- **Confidence:** Confirmed
- **History:** Recurring (by design — server must sign outgoing payloads)

### Description

Webhook signing secrets are stored as binary columns without E2E encryption. This is a necessary design trade-off: the server must read secrets to sign outgoing webhook payloads. If the database is compromised, an attacker can forge HMAC signatures for all webhooks.

### Mitigation

- Database-level encryption at rest (PG TDE, SQLCipher)
- Periodic secret rotation
- User-facing webhook signature verification test endpoint

### References

- CWE-312: Cleartext Storage of Sensitive Information

---

## [LOW] Finding 6: Audit Log PII Retained in Plaintext

- **OWASP:** A09 — Security Logging & Monitoring Failures
- **STRIDE:** Information Disclosure
- **Location:** `packages/db/src/schema/*/audit-log.ts`
- **Confidence:** Confirmed
- **History:** Recurring (cleanup job exists, scheduling unverified)

### Description

IP addresses and user agent strings are stored as plaintext in the audit log. These are GDPR personal data. The `audit-log-cleanup` job and query exist in `packages/db/src/queries/audit-log-cleanup.ts`, but scheduled execution via the job queue should be verified in deployment.

### References

- CWE-532: Insertion of Sensitive Information into Log File

---

## [LOW] Finding 7: Device Transfer Code Entropy (26.5 bits)

- **OWASP:** A02 — Cryptographic Failures
- **STRIDE:** Spoofing
- **Location:** `packages/crypto/src/device-transfer.ts:12-18`
- **Confidence:** Likely
- **History:** Recurring (accepted trade-off)

### Description

Device transfer uses 8 decimal digits (~26.5 bits entropy). Protected by Argon2id mobile profile (32MB/2 iter) and 5-minute timeout. Offline brute force of the full keyspace is theoretically feasible in ~28 hours on modern GPUs if the salt is captured. The QR code also includes the verification code in cleartext (line 240), reducing security from two-factor to single-factor (physical proximity only).

### References

- CWE-330: Use of Insufficiently Random Values

---

## [INFO] Positive Findings

The following areas were tested and found well-implemented:

| Area                        | Finding                                                                   | Location                                                                 |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ZodError Masking            | Production now strips ZodError details (`isProduction ? undefined : err`) | `apps/api/src/middleware/error-handler.ts:92`                            |
| encryptedData Bounds        | All schemas now enforce `.max()` on encrypted payloads                    | `packages/validation/src/system.ts:7`                                    |
| Rate Limit Categories       | Category prefix in keys prevents cross-category collisions                | `apps/api/src/middleware/rate-limit.ts:60`                               |
| Valkey Store Resolution     | Store resolved lazily at request time (not construction time)             | `apps/api/src/middleware/rate-limit.ts:58`                               |
| IP Format Validation        | X-Forwarded-For validated via `isValidIpFormat()` before use              | `apps/api/src/middleware/rate-limit.ts:39`                               |
| Password Schema             | Registration now enforces `min(AUTH_MIN_PASSWORD_LENGTH)`                 | `packages/validation/src/auth.ts:20`                                     |
| Session Token Hashing       | Tokens hashed with BLAKE2b before storage, not returned in listing        | `apps/api/src/lib/session-token.ts:15`                                   |
| Session Revocation          | WHERE clause now includes `accountId` in transaction                      | `apps/api/src/services/auth.service.ts:362`                              |
| Read Rate Limits            | All GET endpoints now have `readDefault` or `readHeavy` limits            | All route files                                                          |
| SQL Injection               | Drizzle ORM parameterized queries throughout, no raw SQL                  | All query code                                                           |
| Command Injection           | No exec/spawn calls in production code                                    | All source files                                                         |
| XSS                         | No dangerouslySetInnerHTML, innerHTML, or eval                            | All source files                                                         |
| SSRF                        | No outbound HTTP requests in production code                              | All source files                                                         |
| Prototype Pollution         | No **proto** or prototype manipulation                                    | All source files                                                         |
| Dependencies                | 0 known CVEs across all packages                                          | `pnpm audit`                                                             |
| RLS Fail-Closed             | `NULLIF(current_setting(..., true), '')` prevents leaks on unset vars     | `packages/db/src/rls/policies.ts:17-19`                                  |
| Key Zeroing                 | All key derivation calls memzero in finally blocks                        | All crypto modules                                                       |
| Encryption                  | XChaCha20-Poly1305 AEAD, Ed25519, Argon2id — modern, well-chosen          | `packages/crypto/`                                                       |
| KEK/DEK Pattern             | Master key survives password reset via envelope encryption                | `packages/crypto/src/master-key-wrap.ts`                                 |
| Stream Encryption           | Chunk AAD prevents reordering/truncation                                  | `packages/crypto/src/symmetric.ts:64-70`                                 |
| Key Grants                  | Authenticated envelope binds bucketId + keyVersion                        | `packages/crypto/src/key-grants.ts`                                      |
| Anti-Timing (Login)         | Dummy Argon2id hash for non-existent accounts                             | `apps/api/src/services/auth.service.ts:227`                              |
| Anti-Enumeration (Register) | Fake recovery key + timing delay                                          | `apps/api/src/services/auth.service.ts:177-188`                          |
| Path Traversal              | Multi-layer defense: ".." check + resolve + startsWith guard              | `packages/storage/src/adapters/filesystem/filesystem-adapter.ts:169-182` |
| Password Change             | Re-wraps master key, revokes all other sessions                           | `apps/api/src/services/account.service.ts`                               |
| Concurrency Control         | Version field with optimistic locking on account updates                  | Account service                                                          |
| IDOR Protection             | All system/session/blob queries scoped to auth.accountId + systemId       | All service files                                                        |
| Blob Access Scoping         | Every blob query includes `eq(blobMetadata.systemId, systemId)`           | `apps/api/src/services/blob.service.ts`                                  |
| Presigned URL TTL           | Upload: 15 min, Download: 1 hour                                          | `apps/api/src/routes/blobs/blobs.constants.ts`                           |
| CORS                        | Default-deny, explicit origin list, no wildcards                          | `apps/api/src/middleware/cors.ts`                                        |
| Security Headers            | CSP `default-src 'self'`, HSTS with preload, X-Frame-Options: DENY        | `apps/api/src/middleware/secure-headers.ts`                              |
| Body Limit                  | 256 KiB global limit with structured 413 error                            | `apps/api/src/index.ts`                                                  |
| Error Masking               | 5xx errors masked in production, no stack traces                          | `apps/api/src/middleware/error-handler.ts:51`                            |
