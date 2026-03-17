---
# api-tu5b
title: Document device transfer code entropy trade-off in ADR
status: completed
type: task
priority: low
created_at: 2026-03-17T11:59:42Z
updated_at: 2026-03-17T18:45:59Z
parent: api-tspr
---

## Security Finding

**Severity:** Low (accepted design trade-off) | **OWASP:** A02 Cryptographic Failures | **STRIDE:** Spoofing
**Confidence:** Likely | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-8

## Context

Device transfer uses 8 decimal digits (~26.5 bits entropy) at `packages/crypto/src/device-transfer.ts:12-13`. Protected by Argon2id mobile profile (2 ops, 32 MiB) and a 5-minute session timeout. Offline brute-force of the full keyspace is feasible in ~28 hours on modern GPUs if the salt is captured.

This finding has appeared in two consecutive security audits. It should be formally documented as an accepted risk with clear justification.

## Task

Document this trade-off in the device transfer ADR. Include:

1. Why 8 digits was chosen (usability: manual transcription between devices)
2. Mitigations: Argon2id cost, 5-minute timeout, server-side attempt limiting
3. Analysis: online brute-force is infeasible; offline requires salt capture
4. Future options: increase to 10-12 digits, use server profile for KDF, add attempt limiting on relay

## Checklist

- [x] Document the entropy trade-off in the device transfer ADR
- [x] Include threat analysis (online vs offline brute-force feasibility)
- [x] Note mitigations and future hardening options
- [x] Reference CWE-330

## References

- CWE-330: Use of Insufficiently Random Values

## Summary of Changes

Created ADR 024 documenting the device transfer code entropy trade-off, including threat analysis, mitigations (Argon2id, 5-min timeout, rate limiting), and future hardening options.
