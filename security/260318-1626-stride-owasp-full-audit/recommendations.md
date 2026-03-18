# Recommendations — Pluralscape Security Audit

Prioritized mitigations with code fix snippets.

---

## Priority 1 — Medium (Fix This Sprint)

### 1. Equalize Login Timing by Adding Dummy Audit Write

**Finding:** [Login Timing Side-Channel](./findings.md#medium-finding-1-login-timing-side-channel-via-audit-write)
**Effort:** 10 minutes
**File:** `apps/api/src/services/auth.service.ts:225-228`

```typescript
// Before (timing leak):
if (!account) {
  verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
  return null;
}

// After (equalized):
if (!account) {
  verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
  // Match the timing of the "invalid password" path by performing a dummy write
  try {
    await audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "anonymous", id: "unknown" },
      detail: "Invalid credentials",
    });
  } catch {
    /* timing equalization must always complete */
  }
  return null;
}
```

**Alternative** (preferred for cleanliness): Move audit writes to a fire-and-forget pattern on both paths, so neither path blocks on the write.

---

### 2. Equalize Password Reset Timing

**Finding:** [Password Reset Path Differentiation](./findings.md#medium-finding-2-password-reset-path-differentiation)
**Effort:** 5 minutes
**File:** `apps/api/src/services/recovery-key.service.ts:233-236`

```typescript
// Before:
if (!activeKey) {
  await equalizeAntiEnumTiming(startTime);
  throw new NoActiveRecoveryKeyError(...);
}

// After:
if (!activeKey) {
  try { verifyPassword(DUMMY_ARGON2_HASH, parsed.newPassword); } catch {}
  await equalizeAntiEnumTiming(startTime);
  throw new NoActiveRecoveryKeyError(...);
}
```

---

### 3. Add Password Max Length to Registration and Change-Password Schemas

**Finding:** [Missing Password Max Length](./findings.md#medium-finding-3-registration-and-change-password-schemas-missing-password-max-length)
**Effort:** 2 minutes
**File:** `packages/validation/src/auth.ts:20,36`

```typescript
// Before:
password: z.string().min(AUTH_MIN_PASSWORD_LENGTH),

// After:
password: z.string().min(AUTH_MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
```

Apply to both `RegistrationInputSchema` (line 20) and `ChangePasswordSchema.newPassword` (line 36).

---

## Priority 2 — Low (Plan for Next Sprint)

### 4. Remove Pre-Transaction Session Revocation Check

**Finding:** [Session Revocation TOCTOU](./findings.md#low-finding-4-session-revocation-pre-transaction-check-is-dead-code)
**Effort:** 10 minutes
**File:** `apps/api/src/services/auth.service.ts:346-380`

```typescript
// Before:
export async function revokeSession(db, sessionId, actorAccountId, audit) {
  const [session] = await db.select()...;
  if (!session || session.revoked) return false;

  return db.transaction(async (tx) => {
    const updated = await tx.update(sessions)
      .set({ revoked: true })
      .where(and(eq(sessions.id, sessionId), eq(sessions.accountId, actorAccountId)))
      .returning(...);
    // ...
  });
}

// After:
export async function revokeSession(db, sessionId, actorAccountId, audit) {
  return db.transaction(async (tx) => {
    const updated = await tx.update(sessions)
      .set({ revoked: true })
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.accountId, actorAccountId),
        eq(sessions.revoked, false),
      ))
      .returning(...);

    if (updated.length === 0) return false;
    // ... audit ...
  });
}
```

---

### 5. Verify Audit Log Cleanup Job Scheduling

**Finding:** [Audit Log PII](./findings.md#low-finding-6-audit-log-pii-retained-in-plaintext)
**Effort:** 30 minutes
**File:** Job queue configuration

Verify that the `audit-log-cleanup` job is registered and scheduled in the BullMQ/SQLite queue at application startup. Add a deployment checklist item to confirm cleanup runs on the expected schedule.

---

### 6. Document Device Transfer Security Model

**Finding:** [Device Transfer Code Entropy](./findings.md#low-finding-7-device-transfer-code-entropy-265-bits)
**Effort:** 15 minutes

Add a security note to `packages/crypto/src/device-transfer.ts` documenting:

- The 26.5-bit entropy is acceptable for physical-proximity transfers
- Offline brute force is theoretically feasible but mitigated by Argon2id + timeout
- Consider removing `code` from QR payload if two-factor verification is desired in future

---

## Priority 3 — Informational (Track for Future)

### 7. Add CodeQL to CI Pipeline

Currently available as `pnpm codeql` (manual). Adding as a CI step would catch security patterns automatically on every PR.

### 8. Add SBOM Generation

Generate Software Bill of Materials for dependency tracking and vulnerability monitoring.

### 9. Consider Account Lockout After Failed Attempts

Currently relies on rate limiting (5/min). Adding exponential backoff or temporary lockout after N failed attempts would strengthen brute-force protection.
