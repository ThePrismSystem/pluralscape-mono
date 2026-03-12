---
# db-dq3f
title: Evaluate accounts.passwordHash security posture
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:33Z
updated_at: 2026-03-12T10:00:25Z
parent: db-2nr7
---

Server can verify passwords directly — weaker than pure challenge-response model. Low risk in practice but worth noting given zero-knowledge goal. Ref: audit L9

## Evaluation

**Current state**: Argon2id hash stored server-side; server receives plaintext password at login to verify.

**Zero-knowledge gap**: In a pure E2E model (SRP/OPAQUE), the server never sees the plaintext password. Currently, the server does see it at login time to run Argon2id verification.

**Risk**: Low. A server breach is required for compromise, and Argon2id resists offline attacks. The password is only in memory transiently during the verification step — it is not logged or persisted in plaintext.

**Recommendation**: Accept for M1/M2. SRP/OPAQUE is a major architectural change that affects the entire auth flow and would warrant a new ADR if pursued. The current model is standard practice and the Argon2id parameters provide strong protection against offline attacks.

## Summary of Changes\n\nEvaluated passwordHash security posture. Current Argon2id model accepted for M1/M2. SRP/OPAQUE deferred as future architectural change.
