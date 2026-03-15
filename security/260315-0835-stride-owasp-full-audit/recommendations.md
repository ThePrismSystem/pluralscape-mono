# Security Recommendations — Pluralscape

Prioritized mitigations for findings from the security audit.

## Priority 1 — High (Address Before Adding API Routes)

### 1. Add Authentication Middleware

**Finding:** [No Authentication or Authorization Middleware](./findings.md#high-finding-1-no-authentication-or-authorization-middleware)
**Effort:** Medium (depends on auth strategy)

Before adding any authenticated API routes, implement:

```typescript
// apps/api/src/middleware/auth.ts
import type { MiddlewareHandler } from "hono";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  // Validate session token or API key against DB
  // Set tenant context for RLS: setTenantContext(db, { systemId, accountId })
  await next();
};
```

### 2. Add Security Headers

**Finding:** [No Security Headers](./findings.md#medium-finding-2-no-security-headers)
**Effort:** 5 minutes

```typescript
import { secureHeaders } from "hono/secure-headers";
app.use("*", secureHeaders());
```

### 3. Configure CORS

**Finding:** [No CORS Configuration](./findings.md#medium-finding-4-no-cors-configuration)
**Effort:** 5 minutes

```typescript
import { cors } from "hono/cors";
app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    credentials: true,
  }),
);
```

### 4. Add Error Handler

**Finding:** [No Global Error Handler](./findings.md#medium-finding-8-no-global-error-handler)
**Effort:** 5 minutes

```typescript
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
```

## Priority 2 — High (Fix This Sprint)

### 5. Enable SQLite Foreign Keys

**Finding:** [SQLite Foreign Keys Not Enforced](./findings.md#medium-finding-5-sqlite-foreign-keys-not-enforced)
**Effort:** 1 minute

```typescript
// packages/db/src/client/factory.ts — after WAL mode line
client.pragma("foreign_keys = ON");
```

### 6. Add Rate Limiting

**Finding:** [No Rate Limiting](./findings.md#medium-finding-3-no-rate-limiting)
**Effort:** Low-Medium

When auth endpoints are implemented:

```typescript
// Rate limit auth endpoints more aggressively
app.use("/api/auth/*", rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use("/api/*", rateLimiter({ windowMs: 60 * 1000, max: 100 }));
```

## Priority 3 — Medium (Plan for Next Sprint)

### 7. Enforce Password Policy

**Finding:** [No Password Complexity Enforcement](./findings.md#medium-finding-6-no-password-complexity-enforcement)
**Effort:** Low

Add validation at the application layer (not crypto layer):

```typescript
function validatePassword(password: string): void {
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  // Consider using zxcvbn for strength estimation
}
```

### 8. Schedule Audit Log Cleanup

**Finding:** [Audit Log PII in Plaintext](./findings.md#low-finding-10-audit-log-pii-in-plaintext)
**Effort:** Low

The cleanup functions already exist. Schedule them via the job queue:

```typescript
// Schedule weekly cleanup
await jobQueue.enqueue({
  type: "audit-log-cleanup",
  idempotencyKey: `audit-cleanup-${weekNumber}`,
  payload: { retentionDays: 90 },
});
```

### 9. Fix Key Version Validation Inconsistency

**Finding:** [Key Version 0 Accepted](./findings.md#info-positive-findings)
**Effort:** 1 minute

```typescript
// packages/crypto/src/validation.ts
export function validateKeyVersion(keyVersion: number): number {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    // Changed from 0 to 1
    throw new InvalidInputError(
      `keyVersion must be a positive safe integer, got ${String(keyVersion)}`,
    );
  }
  return keyVersion;
}
```

## Priority 4 — Low (Track as Hardening)

### 10. Consider Increasing Transfer Code Length

**Finding:** [Transfer Code Entropy](./findings.md#low-finding-9-transfer-code-entropy)
**Effort:** Low

If threat model warrants it, increase from 8 to 10-12 digits. Current mitigations (Argon2id + 5-min timeout) are adequate for most scenarios.

### 11. Add Security Audit to CI

**Effort:** Medium

Add `pnpm audit --audit-level=moderate` to the CI pipeline. The CodeQL setup already exists; consider adding it as a GitHub Actions workflow that runs on PRs.
