# Security Findings

All findings ranked by severity (Critical > High > Medium > Low > Info).

---

## [MEDIUM] Finding 1: Session Error Code Differentiation Leaks Session State {#finding-1}

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Information Disclosure
- **Location:** `apps/api/src/middleware/auth.ts:45-50`
- **Confidence:** Confirmed

### Description

The authentication middleware returns different error codes depending on why a session is invalid. An attacker with a captured token can distinguish between an expired session and a revoked/non-existent one.

### Code Evidence

```typescript
if (!result.ok) {
  const code = result.error === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHENTICATED";
  const message =
    result.error === "SESSION_EXPIRED" ? "Session expired" : "Invalid or revoked session";
  throw new ApiHttpError(HTTP_UNAUTHORIZED, code, message);
}
```

### Attack Scenario

1. Attacker obtains a session token (e.g., from a compromised log or network capture)
2. Attacker sends an authenticated request with the stolen token
3. API returns `SESSION_EXPIRED` (401) — attacker learns the token was valid but expired, confirming it belonged to a real account
4. API returns `UNAUTHENTICATED` (401) — attacker learns the token was never valid or was explicitly revoked
5. This information aids targeted attacks: expired tokens suggest recent activity, revoked tokens suggest the user detected compromise

### Impact

Low-to-medium. The information disclosed is limited to session lifecycle state. It does not directly enable account access but aids reconnaissance.

### Mitigation

Return a single, generic error code and message for all session validation failures:

```typescript
if (!result.ok) {
  throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required");
}
```

- **References:** CWE-204 (Observable Response Discrepancy)

---

## [MEDIUM] Finding 2: Unknown Session Type Falls Back to Web Idle Timeout {#finding-2}

- **OWASP:** A07 — Identification and Authentication Failures
- **STRIDE:** Elevation of Privilege
- **Location:** `apps/api/src/lib/session-auth.ts:96-112`
- **Confidence:** Likely

### Description

When a session's absolute TTL doesn't match any known session type configuration, the `getIdleTimeout()` function defaults to the web idle timeout. The code comment says "fail closed with shortest non-null idle timeout," but the web timeout may not actually be the shortest — if mobile or device-transfer sessions have shorter idle timeouts, unknown sessions get a more permissive policy than intended.

### Code Evidence

```typescript
export function getIdleTimeout(session: {
  expiresAt: number | null;
  createdAt: number;
}): number | null {
  if (session.expiresAt === null) return null;

  const absoluteTtl = session.expiresAt - session.createdAt;

  for (const config of Object.values(SESSION_TIMEOUTS)) {
    if (absoluteTtl === config.absoluteTtlMs) {
      return config.idleTimeoutMs;
    }
  }

  // Unknown session type — fail closed with shortest non-null idle timeout
  return SESSION_TIMEOUTS.web.idleTimeoutMs;
}
```

### Attack Scenario

1. A future code change adds a new session type with a different absolute TTL but shorter idle timeout
2. If the deployment is partially updated (API servers running different versions), a session created by the new code is validated by old code
3. Old code doesn't recognize the TTL, falls back to web idle timeout (potentially longer)
4. The session lives longer than intended

### Impact

Medium. The vulnerability requires specific deployment conditions (version mismatch) but violates the principle of fail-closed. When in doubt, sessions should expire sooner, not later.

### Mitigation

Compute the actual shortest non-null idle timeout dynamically:

```typescript
// Fail closed: use the shortest idle timeout across all known types
const shortestIdle = Math.min(
  ...Object.values(SESSION_TIMEOUTS)
    .map((c) => c.idleTimeoutMs)
    .filter((ms): ms is number => ms !== null),
);
return shortestIdle;
```

- **References:** CWE-613 (Insufficient Session Expiration)

---

## [LOW] Finding 3: Session Count Enforcement Race Condition {#finding-3}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Denial of Service
- **Location:** `apps/api/src/services/auth.service.ts:352-368`
- **Confidence:** Likely

### Description

The session creation logic checks the active session count and revokes the oldest if at capacity, then inserts a new session. This runs within a transaction, but two concurrent login requests could both read the count as being at the limit, both revoke the same oldest session, and both insert — resulting in `MAX_SESSIONS_PER_ACCOUNT + 1` active sessions.

### Code Evidence

```typescript
const [oldest] = await tx
  .select({
    id: sessions.id,
    total: sql<number>`count(*) over()`.as("total"),
  })
  .from(sessions)
  .where(and(eq(sessions.accountId, account.id), eq(sessions.revoked, false), notExpired))
  .orderBy(asc(sessions.lastActive))
  .limit(1);

if (oldest && oldest.total >= MAX_SESSIONS_PER_ACCOUNT) {
  await tx.update(sessions).set({ revoked: true }).where(eq(sessions.id, oldest.id));
}

// ... new session inserted below
```

### Attack Scenario

1. Account has exactly MAX_SESSIONS_PER_ACCOUNT active sessions
2. Two login requests arrive simultaneously
3. Both transactions read `total = MAX_SESSIONS_PER_ACCOUNT`
4. Both revoke the same oldest session (UPDATE is idempotent)
5. Both insert a new session
6. Result: MAX_SESSIONS_PER_ACCOUNT + 1 sessions (one extra)
7. Repeated parallel logins could grow the count further

### Impact

Low. Exceeding the session limit by a small number has minimal security impact. The limit is a best-effort safeguard, not a hard security boundary.

### Mitigation

Use `SELECT ... FOR UPDATE` on the session query to acquire a row-level lock, serializing concurrent session creation:

```typescript
const [oldest] = await tx
  .select({...})
  .from(sessions)
  .where(...)
  .orderBy(asc(sessions.lastActive))
  .limit(1)
  .for("update");
```

- **References:** CWE-362 (Race Condition)

---

## [LOW] Finding 4: Idempotency Middleware Ineffective for Unauthenticated Endpoints {#finding-4}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Tampering
- **Location:** `apps/api/src/middleware/idempotency.ts:40-52`
- **Confidence:** Possible

### Description

The idempotency middleware keys its cache on `(accountId, idempotencyKey)`. For unauthenticated endpoints (registration, login, password reset), `accountId` is undefined, causing the middleware to skip caching and return early. This means the `Idempotency-Key` header has no effect on these endpoints.

### Code Evidence

```typescript
const raw: unknown = c.get("auth");
const auth = raw as { accountId?: string } | undefined;
if (!auth?.accountId) return next();
```

### Attack Scenario

1. Client sends POST /auth/register with `Idempotency-Key: abc123`
2. Middleware sees no accountId, skips caching
3. Network retry sends the same request again
4. Registration handler executes twice
5. Second attempt fails on email uniqueness constraint (safe) but consumes server resources

### Impact

Low. The database uniqueness constraint on `emailHash` prevents duplicate accounts. The main impact is wasted computation (Argon2id hashing, key generation) on retried requests. The `Idempotency-Key` header gives a false sense of protection on unauthenticated endpoints.

### Mitigation

For registration specifically, key the idempotency cache on a hash of the request body (email hash) instead of accountId. Alternatively, document that idempotency is only effective on authenticated endpoints.

- **References:** CWE-799 (Improper Control of Interaction Frequency)

---

## [LOW] Finding 5: Friend Code Expiry Check Uses Client-Side Timestamp {#finding-5}

- **OWASP:** A04 — Insecure Design
- **STRIDE:** Tampering
- **Location:** `apps/api/src/services/friend-code.service.ts:309`
- **Confidence:** Possible

### Description

The friend code redemption checks expiry using `Date.now()` (JavaScript runtime clock) rather than a database-provided timestamp. Within a transaction, there's a small window where a code that's expired by the database clock could still pass the JavaScript check.

### Code Evidence

```typescript
if (codeRow.expiresAt !== null && codeRow.expiresAt < Date.now()) {
  throw new ApiHttpError(HTTP_BAD_REQUEST, "FRIEND_CODE_EXPIRED", "Friend code has expired");
}
```

### Attack Scenario

1. Friend code expires at timestamp T
2. Request arrives at T - 1ms, JavaScript evaluates `Date.now()` as T - 1
3. Expiry check passes (T - 1 < T is false, so code is "not expired")
4. Transaction continues, commits at T + 5ms
5. Code redeemed 5ms after expiry

### Impact

Negligible in practice. The timing window is sub-millisecond, and friend code expiry is not a security-critical boundary.

### Mitigation

Use a database-provided timestamp for consistency:

```typescript
const [{ now }] = await tx.select({ now: sql<number>`EXTRACT(EPOCH FROM NOW()) * 1000` });
if (codeRow.expiresAt !== null && codeRow.expiresAt < now) { ... }
```

- **References:** CWE-367 (Time-of-check Time-of-use)

---

## [INFO] Finding 6: Transfer Code Documentation Bug {#finding-6}

- **Location:** `packages/crypto/src/device-transfer.ts:262`
- **Confidence:** Confirmed

### Description

The JSDoc comment for `isValidTransferCode()` states "8 decimal digits" but the actual implementation validates 10 decimal digits (`TRANSFER_CODE_LENGTH = 10`, pattern `^\d{10}$`).

### Code Evidence

```typescript
/**
 * Check whether a transfer code string has the correct format (8 decimal digits).
 */
export function isValidTransferCode(code: string): boolean {
  return TRANSFER_CODE_PATTERN.test(code);
}
```

### Impact

No security impact. Documentation inaccuracy only.

### Mitigation

Update the JSDoc to say "10 decimal digits."

---

## [FALSE POSITIVE] ~~Finding 7: Email Encryption Key Intermediate Buffer Not Zeroed~~ {#finding-7}

- **Location:** `apps/api/src/lib/email-encrypt.ts:68-69`
- **Confidence:** Retracted

### Description

Originally reported as an intermediate buffer not being zeroed after `fromHex()`. On closer inspection, `fromHex()` allocates a single `Uint8Array` and returns it directly — `const key = fromHex(hex)` means `key` IS the same object reference as the `fromHex` return value. The existing `getSodium().memzero(key)` in the `finally` block already zeros the only buffer that was created. No intermediate buffer exists.

### Resolution

False positive. No action required.
