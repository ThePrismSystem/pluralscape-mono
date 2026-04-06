# Recommendations — Pluralscape Full Audit

**Date:** 2026-04-06
**Priority order:** Fix Critical/High first, then Medium, then Low.

---

## Priority 1 — High (Fix This Sprint)

### 1. Enforce SMTP TLS in Production

**Finding:** [SMTP Plaintext Email](./findings.md#finding-1)
**Effort:** 10 minutes
**File:** `apps/api/src/env.ts:74-77`

Add a production refinement to the env schema that requires `SMTP_SECURE=1` when using the SMTP provider in production:

```typescript
// In the createEnv() runtimeEnvStrict or via .superRefine():
.superRefine((env, ctx) => {
  if (isProduction && env.EMAIL_PROVIDER === "smtp" && !env.SMTP_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SMTP_SECURE must be '1' in production when using SMTP provider",
      path: ["SMTP_SECURE"],
    });
  }
})
```

Alternative: Default `SMTP_SECURE` to `"1"` in production and `"0"` in development.

---

## Priority 2 — Medium (Fix Next Sprint)

### 2. Tighten Content Security Policy

**Finding:** [Incomplete CSP](./findings.md#finding-2)
**Effort:** 5 minutes
**File:** `apps/api/src/middleware/secure-headers.ts`

Since this is a pure API server (no HTML responses), use the most restrictive CSP:

```typescript
"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'; upgrade-insecure-requests"
```

### 3. Enable IP Pinning in Webhook Delivery

**Finding:** [Webhook DNS Rebinding](./findings.md#finding-3)
**Effort:** 30 minutes
**File:** `apps/api/src/jobs/webhook-deliver.ts`

The IP pinning utility already exists (`buildIpPinnedFetchArgs` in `apps/api/src/lib/ip-validation.ts`). Use it in the webhook delivery worker:

```typescript
// In webhook delivery worker, replace direct fetch with:
const { url: pinnedUrl, init: pinnedInit } = await buildIpPinnedFetchArgs(webhookUrl);
const response = await fetch(pinnedUrl, {
  ...pinnedInit,
  method: "POST",
  body: signedPayload,
  headers: webhookHeaders,
});
```

This resolves DNS at delivery time and validates the resolved IP against the same blocklist used at creation time, closing the rebinding window.

### 4. Implement API Key Authentication (or Remove Endpoints)

**Finding:** [API Key Auth Gap](./findings.md#finding-4)
**Effort:** 2-4 hours (implement) or 30 minutes (remove)

**Option A — Implement:** Add API key auth middleware that:

1. Checks for `X-API-Key` header or `ApiKey` prefix in Authorization
2. Hashes the key and looks up in `apiKeys` table
3. Validates: not revoked, not expired, account matches
4. Enforces scope restrictions on the matched procedure

**Option B — Remove:** If API keys are not yet needed, remove the CRUD endpoints and database table to reduce attack surface. Re-add when the feature is actually needed.

---

## Priority 3 — Low (Plan for Future Sprint)

### 5. Add Per-Account Recovery Key Rate Limiting

**Finding:** [Coarse Recovery Rate Limit](./findings.md#finding-5)
**Effort:** 1 hour

Add a dedicated rate limiter for recovery key attempts, separate from the login rate limiter:

```typescript
const recoveryRateLimiter = createCategoryRateLimiter("recovery", {
  windowMs: 3600_000, // 1 hour
  max: 3, // 3 attempts per account per hour
  keyExtractor: accountKeyExtractor,
});
```

### 6. Add Resource Quotas for Core Entities

**Finding:** [Missing Entity Quotas](./findings.md#finding-6)
**Effort:** 2-3 hours

Add per-system limits for entities that currently have no caps:

| Entity          | Suggested Limit   |
| --------------- | ----------------- |
| Members         | 500 per system    |
| Groups          | 200 per system    |
| Custom fronts   | 100 per system    |
| Journal entries | 10,000 per system |
| Wiki pages      | 1,000 per system  |
| Channels        | 200 per system    |

Implement as count check in service layer before insert (consistent with existing patterns for webhooks, field definitions, etc.).

### 7. Add Session Revocation Audit Event

**Finding:** [Missing Audit Event](./findings.md#finding-7)
**Effort:** 15 minutes

Add `auth.session-revoked` to the audit event types and emit it when a user manually revokes a specific session via the session management endpoint.

---

## No Action Required

The following areas were audited and found to be secure:

- **Cryptography:** XChaCha20-Poly1305, Argon2id (OWASP Sensitive), BLAKE2b KDF, Ed25519 signing — all correctly implemented with proper nonce generation and memory safety
- **SQL Injection:** Drizzle ORM parameterized queries throughout
- **Access Control:** RLS policies on all tables, `ownedSystemIds` pre-populated from DB
- **Session Management:** SHA-256 hashed tokens, idle + absolute timeout, revocation
- **WebSocket Security:** Auth timeout, pre-auth message rejection, connection caps
- **Rate Limiting:** Per-category across HTTP, tRPC, WebSocket, and SSE
- **Dependencies:** Zero known CVEs, SHA-pinned CI actions, digest-pinned Docker images
- **Input Validation:** Zod on all tRPC inputs, branded ID types
- **CORS:** Proper wildcard validation, bare `*` rejected
- **Error Handling:** Generic errors in production, no stack traces or DB details leaked
