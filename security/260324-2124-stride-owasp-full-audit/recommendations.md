# Recommendations — Pluralscape Security Audit 2026-03-24

Prioritized mitigations for all findings.

---

## Priority 1 — High (Fix This Sprint)

### 1. Activate RLS Context in API Layer

**Finding:** [RLS Policies Not Activated](./findings.md#high-finding-1-rls-policies-defined-but-never-activated-at-runtime)
**Effort:** Medium (1-2 days)

The RLS policies are deployed and correctly configured with fail-closed defaults. They just need tenant context set before queries execute.

**Option A — Per-service activation:**

```typescript
import { setTenantContext } from "@pluralscape/db";

export async function getMember(db, systemId, memberId, auth) {
  await setTenantContext(db, { systemId, accountId: auth.accountId });
  // Existing query code — now protected by both app-layer AND RLS
}
```

**Option B — Middleware-based activation (recommended):**

```typescript
// apps/api/src/middleware/rls-context.ts
export function rlsContextMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth");
    const systemId = c.req.param("systemId");
    const db = await getDb();
    if (auth && systemId) {
      await setTenantContext(db, { systemId, accountId: auth.accountId });
    } else if (auth) {
      await setAccountId(db, auth.accountId);
    }
    await next();
  };
}
```

---

### 2. Add Per-IP WebSocket Connection Limiting

**Finding:** [WS Global Unauthed Cap](./findings.md#medium-finding-5-websocket-global-unauthed-connection-cap-without-per-ip-tracking)
**Effort:** Low (few hours)

```typescript
// apps/api/src/ws/connection-manager.ts
private readonly ipUnauthCount = new Map<string, number>();
private static readonly PER_IP_UNAUTH_LIMIT = 50;

canAcceptFromIp(ip: string): boolean {
  return (this.ipUnauthCount.get(ip) ?? 0) < ConnectionManager.PER_IP_UNAUTH_LIMIT;
}
```

---

### 3. Add Biometric Token Single-Use Enforcement

**Finding:** [Biometric Token Replay](./findings.md#medium-finding-4-biometric-token-replay--no-single-use-enforcement)
**Effort:** Low (few hours)

```sql
ALTER TABLE biometric_tokens ADD COLUMN used_at TIMESTAMPTZ;
```

```typescript
// In biometric.service.ts verify():
const [match] = await tx
  .update(biometricTokens)
  .set({ usedAt: new Date() })
  .where(and(eq(biometricTokens.tokenHash, tokenHash), isNull(biometricTokens.usedAt)))
  .returning();
if (!match) throw new ApiHttpError(401, "INVALID_TOKEN");
```

---

## Priority 2 — Medium (Plan for Next Sprint)

### 4. Add Missing Security Headers

**Finding:** [Missing Referrer-Policy + Permissions-Policy](./findings.md#medium-finding-6-missing-referrer-policy-and-permissions-policy-security-headers)
**Effort:** Trivial (minutes)

```typescript
// apps/api/src/middleware/secure-headers.ts
headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
```

### 5. Add Per-Account Session Limit

**Finding:** [No Session Limit](./findings.md#medium-finding-7-no-per-account-session-limit)
**Effort:** Low (few hours)

```typescript
const MAX_SESSIONS = 50; // Generous limit

const [{ count: sessionCount }] = await db
  .select({ count: count() })
  .from(sessions)
  .where(and(eq(sessions.accountId, accountId), gt(sessions.expiresAt, new Date())));

if (sessionCount >= MAX_SESSIONS) {
  // Evict oldest session
  await db.delete(sessions).where(eq(sessions.id, oldestSessionId));
}
```

### 6. Fix Login Throttle Enumeration

**Finding:** [Email Enumeration via Throttle](./findings.md#medium-finding-3-email-enumeration-via-login-throttle-timing)
**Effort:** Low (few hours)

Store dummy throttle entries for non-existent accounts, keyed on the email hash. Ensure the throttle store returns identical behavior regardless of account existence.

### 7. Fix Blob Upload Idempotency Race

**Finding:** [Blob Upload Race](./findings.md#medium-finding-8-blob-upload-idempotency-race-condition)
**Effort:** Low

Move the `uploadedAt === null` check inside the transaction with a `FOR UPDATE` lock.

---

## Priority 3 — Low (Backlog)

### 8. Equalize Password Reset Timing

**Finding:** [Reset Timing Gap](./findings.md#low-finding-9-password-reset-timing-not-fully-equalized)
**Effort:** Low

Apply `equalizeAntiEnumTiming()` to the wrong-recovery-key path.

### 9. Harden Envelope Signature Toggle

**Finding:** [Verification Configurable](./findings.md#low-finding-10-websocket-envelope-signature-verification-configurable-to-disabled)
**Effort:** Trivial

Log WARN-level message when verification is disabled. Consider removing the toggle.

### 10. Fix Key Rotation Sealing Race

**Finding:** [Sealing Race](./findings.md#low-finding-11-key-rotation-sealing-race-condition)
**Effort:** Low

Extend `FOR UPDATE` lock to cover full sealing phase.

### 11. Fix Webhook Deletion TOCTOU

**Finding:** [Webhook Delete Race](./findings.md#low-finding-12-webhook-deletion-toctou)
**Effort:** Low

Move pending delivery check inside the deletion transaction.

### 12. ~~Add CodeQL to CI~~ — Not Needed

CodeQL is already running via GitHub's default code scanning setup on every PR and main push (confirmed via API).
