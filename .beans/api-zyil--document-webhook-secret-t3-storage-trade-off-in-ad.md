---
# api-zyil
title: Document webhook secret T3 storage trade-off in ADR
status: completed
type: task
priority: low
created_at: 2026-03-17T11:59:42Z
updated_at: 2026-03-17T18:53:51Z
parent: api-tspr
---

## Security Finding

**Severity:** Low (accepted design trade-off) | **OWASP:** A02 Cryptographic Failures | **STRIDE:** Information Disclosure
**Confidence:** Confirmed | **Audit:** security/260317-1144-stride-owasp-full-audit/findings.md#finding-6

## Context

Webhook HMAC signing secrets are stored as binary columns without E2E encryption (T3 tier — server-readable) in `packages/db/src/schema/*/webhooks.ts`. This is a necessary design trade-off: the server must read webhook secrets to sign outgoing payloads, so E2E encryption is not possible.

This finding has appeared in two consecutive security audits. It should be formally documented as an accepted risk.

## Task

Document this trade-off in the relevant ADR or create a new ADR if one doesn't exist. Include:

1. Why E2E encryption is not possible for webhook secrets
2. Mitigations in place (database-level encryption at rest via PG TDE / SQLCipher)
3. Recommendation for periodic secret rotation
4. Recommendation for user-facing webhook signature verification test endpoint

## Checklist

- [x] Document the T3 webhook secret trade-off in an ADR
- [x] Note mitigations: database encryption at rest, secret rotation, signature verification
- [x] Reference CWE-312 and the security audit findings

## References

- CWE-312: Cleartext Storage of Sensitive Information

## Summary of Changes

Created ADR 025 documenting why webhook HMAC secrets must be stored at T3 tier (server-readable), compensating controls (encryption at rest, access control, rotation), and recommendation for a signature verification endpoint.
