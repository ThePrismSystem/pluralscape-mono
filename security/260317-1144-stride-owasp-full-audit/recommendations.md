# Recommendations — Pluralscape Security Audit

Prioritized mitigations for all findings. Effort estimates assume familiarity with the codebase.

---

## Priority 1 — Medium (Fix This Sprint)

### 1. Strip ZodError Details in Production

**Finding:** [ZodError Details Leak](./findings.md#medium-finding-1-zoderror-details-leak-in-production-responses)
**Effort:** 5 minutes
**File:** `apps/api/src/middleware/error-handler.ts:84-92`

```typescript
// Before (leaks schema structure)
if (err instanceof Error && err.name === "ZodError") {
  return formatError(c, HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", requestId, isProduction, err);
}

// After (details only in development)
if (err instanceof Error && err.name === "ZodError") {
  return formatError(
    c,
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "Validation failed",
    requestId,
    isProduction,
    isProduction ? undefined : err,
  );
}
```

### 2. Add Max Length to encryptedData Schema

**Finding:** [Unbounded encryptedData](./findings.md#medium-finding-2-unbounded-encrypteddata-string-in-system-update-schema)
**Effort:** 10 minutes (determine appropriate max, add constant, update schema)
**File:** `packages/validation/src/system.ts:5`

```typescript
// Before
encryptedData: z.string().min(1),

// After — determine actual max from crypto layer (e.g., max system metadata size)
encryptedData: z.string().min(1).max(MAX_ENCRYPTED_SYSTEM_DATA_SIZE),
```

Add constant to `packages/validation/src/validation.constants.ts` with JSDoc explaining the derivation.

### 3. Add accountId to Session Revocation WHERE Clause

**Finding:** [Session Revocation TOCTOU](./findings.md#medium-finding-3-session-revocation-toctou-defense-in-depth-gap)
**Effort:** 5 minutes
**File:** `apps/api/src/services/auth.service.ts:360-364`

```typescript
// Before
.where(eq(sessions.id, sessionId))

// After
.where(and(eq(sessions.id, sessionId), eq(sessions.accountId, actorAccountId)))
```

This also eliminates the need for the separate ownership check before the transaction (lines 349-353), simplifying the function.

---

## Priority 2 — Low (Plan for Next Sprint)

### 4. Validate X-Forwarded-For as IP Format

**Finding:** [IP Format Validation](./findings.md#low-finding-4-x-forwarded-for-not-validated-as-ip-format)
**Effort:** 15 minutes
**Files:** `apps/api/src/middleware/rate-limit.ts:36`, `apps/api/src/lib/request-meta.ts:19`

Extract IP validation into a shared utility:

```typescript
// apps/api/src/lib/ip-validation.ts
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export function isValidIp(value: string): boolean {
  return IPV4_RE.test(value) || value.includes(":");
}

export function extractTrustedIp(header: string | undefined): string | null {
  const candidate = header?.split(",")[0]?.trim();
  return candidate && isValidIp(candidate) ? candidate : null;
}
```

### 5. Enforce Password Minimum in Registration Schema

**Finding:** [Password Schema Inconsistency](./findings.md#low-finding-5-password-validation-schema-inconsistency)
**Effort:** 5 minutes
**File:** `packages/validation/src/auth.ts:17`

```typescript
// Before
password: z.string().min(1),

// After
password: z.string().min(AUTH_MIN_PASSWORD_LENGTH),
```

Keep `LoginCredentialsSchema` at `min(1)` — you can't retroactively enforce policy on existing passwords during login.

### 6. Schedule Audit Log Cleanup

**Finding:** [Audit Log PII](./findings.md#low-finding-7-audit-log-pii-in-plaintext)
**Effort:** 30 minutes
**Action:** Ensure `audit-log-cleanup.ts` queries are registered as a recurring BullMQ job with appropriate retention period (e.g., 90 days for IP/UA data).

---

## Priority 3 — Informational (No Action Required)

### 7. Webhook Secret Storage (Accepted Design Trade-off)

Server must read secrets to sign payloads. Mitigate via database-level encryption at rest and secret rotation.

### 8. Device Transfer Code Entropy (Accepted Trade-off)

26.5 bits with Argon2id + 5-minute timeout is acceptable for the use case. Document the trade-off in the ADR.

---

## Summary

| Priority | Findings | Effort |
|----------|----------|--------|
| P1 (This Sprint) | 3 Medium | ~20 minutes total |
| P2 (Next Sprint) | 3 Low | ~50 minutes total |
| P3 (No Action) | 2 Info | — |
