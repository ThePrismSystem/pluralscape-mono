---
# api-sojx
title: 'Security audit: authentication and authorization'
status: completed
type: task
priority: critical
created_at: 2026-03-29T02:58:44Z
updated_at: 2026-03-30T22:44:47Z
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

- [x] Map every route to its auth middleware status (protected/unprotected)
- [x] Verify no protected endpoint missing auth middleware
- [x] Verify IDOR prevention on every system-scoped endpoint
- [x] Verify IDOR prevention on every nested resource endpoint
- [x] Audit session token entropy and lifecycle
- [x] Audit password/recovery key flows
- [x] Audit 2FA flows (enrollment, validation, bypass)
- [x] Audit device transfer security
- [x] Audit biometric auth flow
- [x] Fix all issues found (follow-up beans for design decisions)
- [x] Document findings in audit report

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.


## Summary of Changes

Full audit completed. All auth middleware coverage verified (304 routes, 3 expected public). IDOR prevention confirmed via assertSystemOwnership() in all services. Session management robust (256-bit entropy, BLAKE2b hashing, absolute TTL + idle timeout). Anti-enumeration controls verified on all unauthenticated routes. Biometric and device transfer flows secure.

Findings:
- HIGH: Password change only revokes other sessions (follow-up: api-fg7s)
- LOW: Idle timeout bypass for unknown session types (follow-up: api-6zw8)

Audit report: docs/local-audits/015-api-security-audit-2026-03-30.md
