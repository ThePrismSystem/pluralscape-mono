---
# api-swt5
title: Add accountId to session revocation WHERE clause (TOCTOU fix)
status: todo
type: bug
priority: high
created_at: 2026-03-17T11:59:41Z
updated_at: 2026-03-17T11:59:41Z
parent: api-tspr
---

## Security Finding

**Severity:** Medium | **OWASP:** A01 Broken Access Control | **STRIDE:** Elevation of Privilege
**Confidence:** Confirmed (gap exists; not directly exploitable today) | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-3

## Problem

`apps/api/src/services/auth.service.ts:349-364` — `revokeSession()` performs an ownership check (line 351) outside the database transaction, then executes the UPDATE (line 363) inside the transaction filtering only by `sessions.id`. The `accountId` is not re-verified in the UPDATE WHERE clause.

While `accountId` on sessions is immutable today, this violates defense-in-depth. If a future change allows session reassignment, ownership would be bypassable.

```typescript
// Line 349-375
export async function revokeSession(db, sessionId, actorAccountId, audit) {
  // Ownership check OUTSIDE transaction
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (session?.accountId !== actorAccountId) return false;  // line 351
  if (session.revoked) return false;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(eq(sessions.id, sessionId))  // line 363: only sessionId, no accountId
      .returning({ id: sessions.id });
    // ...
  });
}
```

## Fix

Include accountId in the transaction WHERE clause. This also simplifies the function by making the pre-transaction ownership check unnecessary:

```typescript
.where(and(eq(sessions.id, sessionId), eq(sessions.accountId, actorAccountId)))
```

Consider collapsing the ownership check + transaction into a single atomic operation.

## Checklist

- [ ] Add accountId to the UPDATE WHERE clause in revokeSession()
- [ ] Consider removing the pre-transaction ownership check (now redundant)
- [ ] Update tests to verify cross-account revocation is rejected atomically
- [ ] Verify revokeAllSessions() already has accountId in WHERE (it does — line 390)

## References

- CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition
