# Recommendations

Prioritized mitigations for all findings, ordered by severity and effort.

---

## Priority 1 — Medium (Fix This Sprint)

### 1. Unify Session Error Codes

**Finding:** [Session Error Code Differentiation](./findings.md#finding-1)
**Effort:** 5 minutes
**Fix:**

```typescript
// apps/api/src/middleware/auth.ts:45-50

// Before (leaks session state)
if (!result.ok) {
  const code = result.error === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHENTICATED";
  const message =
    result.error === "SESSION_EXPIRED" ? "Session expired" : "Invalid or revoked session";
  throw new ApiHttpError(HTTP_UNAUTHORIZED, code, message);
}

// After (generic response)
if (!result.ok) {
  throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required");
}
```

**Client impact:** Mobile app should not depend on `SESSION_EXPIRED` vs `UNAUTHENTICATED` distinction. Any 401 should trigger re-authentication. If the client does distinguish these, update the client first.

### 2. Compute Shortest Idle Timeout for Unknown Sessions

**Finding:** [Unknown Session Type Idle Timeout](./findings.md#finding-2)
**Effort:** 10 minutes
**Fix:**

```typescript
// apps/api/src/lib/session-auth.ts:96-112

// Before (hardcoded fallback)
return SESSION_TIMEOUTS.web.idleTimeoutMs;

// After (computed shortest)
const allTimeouts = Object.values(SESSION_TIMEOUTS)
  .map((c) => c.idleTimeoutMs)
  .filter((ms): ms is number => ms !== null);

return allTimeouts.length > 0 ? Math.min(...allTimeouts) : 0;
```

---

## Priority 2 — Low (Plan for Next Sprint)

### 3. Add Row Lock for Session Count Enforcement

**Finding:** [Session Count Race Condition](./findings.md#finding-3)
**Effort:** 15 minutes
**Fix:**

Use `SELECT ... FOR UPDATE` to serialize concurrent session creation. In Drizzle ORM, this can be achieved by using a raw SQL wrapper for the count query:

```typescript
// Acquire advisory lock or use FOR UPDATE on the oldest session
const [oldest] = await tx
  .select({
    id: sessions.id,
    total: sql<number>`count(*) over()`.as("total"),
  })
  .from(sessions)
  .where(and(eq(sessions.accountId, account.id), eq(sessions.revoked, false), notExpired))
  .orderBy(asc(sessions.lastActive))
  .limit(1)
  .for("update");
```

Alternatively, use a PostgreSQL advisory lock keyed on the account ID.

### 4. Document Idempotency Scope

**Finding:** [Idempotency Middleware Skip](./findings.md#finding-4)
**Effort:** 5 minutes

Add documentation that `Idempotency-Key` is only effective on authenticated endpoints. The database uniqueness constraint on `emailHash` already prevents duplicate registrations, so the design is safe — but the header gives a false sense of protection.

### 5. Use Database Timestamp for Friend Code Expiry

**Finding:** [Friend Code TOCTOU](./findings.md#finding-5)
**Effort:** 10 minutes
**Fix:**

```typescript
// apps/api/src/services/friend-code.service.ts:309

// Before (JavaScript clock)
if (codeRow.expiresAt !== null && codeRow.expiresAt < Date.now()) {

// After (database clock)
const [{ dbNow }] = await tx.select({ dbNow: sql<number>`EXTRACT(EPOCH FROM NOW()) * 1000` });
if (codeRow.expiresAt !== null && codeRow.expiresAt < dbNow) {
```

---

## Priority 3 — Info (Backlog)

### 6. Fix Transfer Code Documentation

**Finding:** [Documentation Bug](./findings.md#finding-6)
**Effort:** 1 minute
**Fix:** Change JSDoc at `packages/crypto/src/device-transfer.ts:262` from "8 decimal digits" to "10 decimal digits."

### 7. Improve Email Key Memory Hygiene

**Finding:** [Intermediate Buffer](./findings.md#finding-7)
**Effort:** 30 minutes

Consider caching the decoded email encryption key at application startup (decoded once from hex) and zeroing it only at shutdown, rather than decoding + zeroing on every request. This eliminates intermediate buffers and improves performance.

---

## Security Hardening Suggestions (No Findings — Defense in Depth)

These are not findings but optional hardening measures for defense in depth:

1. **Certificate Pinning (Mobile):** Consider implementing certificate pinning for the WebSocket and REST connections in the mobile app. This prevents MITM attacks even if the device's CA store is compromised.

2. **Key Rotation Documentation:** Document the operational procedure for rotating `EMAIL_HASH_PEPPER`, `EMAIL_ENCRYPTION_KEY`, and `WEBHOOK_PAYLOAD_ENCRYPTION_KEY`. Include migration steps for re-encrypting existing data.

3. **Webhook URL Monitoring:** Log and alert on webhook delivery failures that indicate SSRF probing (repeated failures to different internal-looking hostnames).

4. **Session Activity Anomaly Detection:** Consider logging when a session is used from a different IP/User-Agent than the one that created it (without blocking — just logging for review).
