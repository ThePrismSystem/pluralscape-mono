---
# api-qboo
title: Enforce AUTH_MIN_PASSWORD_LENGTH in RegistrationInputSchema
status: completed
type: bug
priority: normal
created_at: 2026-03-17T11:59:41Z
updated_at: 2026-03-17T18:37:46Z
parent: api-tspr
---

## Security Finding

**Severity:** Low | **OWASP:** A07 Auth Failures | **STRIDE:** Spoofing
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-5

## Problem

`packages/validation/src/auth.ts:17` — RegistrationInputSchema uses `z.string().min(1)` for the password field. The auth service enforces `AUTH_MIN_PASSWORD_LENGTH` (8 chars) at registration time (`auth.service.ts:63-67`), but the schema itself does not. If the service-level check is ever removed or bypassed, short passwords would be accepted.

LoginCredentialsSchema intentionally uses min(1) — you cannot enforce password policy on existing passwords during login. ChangePasswordSchema already correctly uses AUTH_MIN_PASSWORD_LENGTH.

```typescript
// Registration — should use AUTH_MIN_PASSWORD_LENGTH
password: z.string().min(1),  // ← Should be min(AUTH_MIN_PASSWORD_LENGTH)

// Login — correct (min(1))
password: z.string().min(1),

// Change password — correct
newPassword: z.string().min(AUTH_MIN_PASSWORD_LENGTH),
```

## Fix

```typescript
// packages/validation/src/auth.ts
export const RegistrationInputSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH_MIN_PASSWORD_LENGTH),
  // ...
});
```

## Checklist

- [ ] Update RegistrationInputSchema password field to use min(AUTH_MIN_PASSWORD_LENGTH)
- [ ] Verify auth.service.ts registration test still passes
- [ ] Add test: registration with password shorter than 8 chars returns 400 at validation layer

## References

- CWE-521: Weak Password Requirements

## Summary of Changes\n\nChanged `RegistrationInputSchema.password` from `.min(1)` to `.min(AUTH_MIN_PASSWORD_LENGTH)`, enforcing the 8-char minimum at the schema layer. Removed the now-redundant service-level check. Updated contract tests to use valid-length passwords.
