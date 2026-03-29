---
# api-sojx
title: "Security audit: authentication and authorization"
status: todo
type: task
priority: critical
created_at: 2026-03-29T02:58:44Z
updated_at: 2026-03-29T03:03:11Z
parent: api-e7gt
---

In-depth security audit of authentication and authorization across every endpoint.

## Scope

### Authentication Coverage

- Verify `authMiddleware()` is applied to every endpoint that should be protected
- Verify no protected endpoint is accidentally unprotected
- Verify unauthenticated endpoints (register, login, recovery) don't leak data
- Session token handling: generation entropy, storage, expiration, revocation
- Biometric auth flow: challenge-response integrity
- Device transfer: secure handoff, no token reuse

### Authorization / IDOR Prevention

- Every system-scoped endpoint verifies the authenticated account owns the target system
- Every nested resource (member, group, channel, etc.) verifies system ownership
- No direct object reference allows cross-account access
- Verify `systemId` ownership checks are consistent and unforgeable
- Test: create resource as Account A, attempt access as Account B

### Session Management

- Session expiration enforced server-side
- Concurrent session limits (if applicable)
- Session revocation is immediate (not eventual)
- `lastActive` throttling doesn't create timing side-channels

### Password / Recovery Key

- Password change invalidates other sessions (or should it?)
- Recovery key regeneration security (requires current auth)
- Argon2id parameters are current best practice

### 2FA

- TOTP validation: time window, replay prevention
- 2FA bypass scenarios (recovery key flow)
- 2FA enrollment/disenrollment requires current auth

## Checklist

- [ ] Map every route to its auth middleware status (protected/unprotected)
- [ ] Verify no protected endpoint missing auth middleware
- [ ] Verify IDOR prevention on every system-scoped endpoint
- [ ] Verify IDOR prevention on every nested resource endpoint
- [ ] Audit session token entropy and lifecycle
- [ ] Audit password/recovery key flows
- [ ] Audit 2FA flows (enrollment, validation, bypass)
- [ ] Audit device transfer security
- [ ] Audit biometric auth flow
- [ ] Fix all issues found
- [ ] Document findings in audit report

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
