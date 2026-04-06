# Security Audit — STRIDE + OWASP Full Audit

**Date:** 2026-04-06 08:08
**Scope:** Full monorepo — apps/api, apps/mobile, packages/crypto, packages/db, packages/sync, packages/storage, packages/queue, packages/email, packages/rotation-worker, packages/validation
**Focus:** Comprehensive
**Iterations:** 24 vectors tested
**Auditor:** Autonomous security sweep (autoresearch-security)

## Summary

- **Total Findings:** 7
  - Critical: 0 | High: 1 | Medium: 3 | Low: 2 | Info: 2
- **STRIDE Coverage:** 6/6 categories tested
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 4 | Likely: 1 | Possible: 2
- **Metric Score:** 87/100 (coverage 80 + findings 7)

## Overall Assessment

Pluralscape has a **strong security posture** for a pre-production application. The architecture demonstrates security-first design with defense-in-depth: E2E encryption (XChaCha20-Poly1305), comprehensive RLS policies, per-category rate limiting, Argon2id password hashing, anti-enumeration timing, and SHA-pinned CI/CD.

No critical vulnerabilities were found. The highest-severity finding (SMTP plaintext) is a configuration hardening issue, not an exploitable code flaw. The codebase's zero-knowledge encryption model means that even server-side compromises have limited impact on user data confidentiality.

## Top Findings

1. **[HIGH] [SMTP Plaintext Email](./findings.md#finding-1)** — `SMTP_SECURE` defaults to false, not enforced in production. Password reset and security notification emails could be sent over plaintext SMTP.

2. **[MEDIUM] [Incomplete CSP](./findings.md#finding-2)** — Content-Security-Policy only sets `default-src 'self'`. For a pure API server, `default-src 'none'` with explicit directives would be more restrictive.

3. **[MEDIUM] [Webhook DNS Rebinding](./findings.md#finding-3)** — IP pinning utility exists but isn't used in webhook delivery, leaving a DNS rebinding TOCTOU window for SSRF.

4. **[MEDIUM] [API Key Auth Gap](./findings.md#finding-4)** — API key CRUD exists but no authentication middleware consumes them. Feature is incomplete.

## STRIDE Coverage

| Category               | Tested | Findings                       |
| ---------------------- | ------ | ------------------------------ |
| Spoofing               | ✓      | 1 (Low — recovery rate limit)  |
| Tampering              | ✓      | 1 (Medium — DNS rebinding)     |
| Repudiation            | ✓      | 1 (Info — missing audit event) |
| Information Disclosure | ✓      | 2 (High — SMTP, Medium — CSP)  |
| Denial of Service      | ✓      | 1 (Low — no entity quotas)     |
| Elevation of Privilege | ✓      | 1 (Medium — API key auth)      |

## Files in This Report

- [Threat Model](./threat-model.md) — STRIDE analysis, assets, trust boundaries
- [Attack Surface Map](./attack-surface-map.md) — entry points, data flows, abuse paths
- [Findings](./findings.md) — all findings ranked by severity
- [OWASP Coverage](./owasp-coverage.md) — per-category test results
- [Dependency Audit](./dependency-audit.md) — known CVEs in dependencies
- [Recommendations](./recommendations.md) — prioritized mitigations with code snippets
- [Iteration Log](./security-audit-results.tsv) — raw data from every vector tested

## Key Strengths

- **Zero-knowledge encryption**: Client encrypts all sensitive data before sending; server stores opaque blobs. Master key hierarchy with KDF-derived sub-keys.
- **RLS everywhere**: All 90+ tables have row-level security policies with fail-closed NULLIF() guards.
- **Rate limiting on all layers**: HTTP, tRPC, WebSocket mutations/reads, SSE streams — all with per-category limits.
- **Anti-enumeration**: Constant-time dummy hash verification on invalid accounts.
- **Supply chain security**: Zero CVEs, SHA-pinned CI actions, digest-pinned Docker images, frozen lockfile.
- **Idempotency**: Registration, blob upload, and other critical operations are idempotent with deduplication.
- **Memory safety**: Sensitive key material cleared with memzero() after use.
