# Security Audit — Comprehensive STRIDE + OWASP

**Date:** 2026-03-31 13:47
**Scope:** Full monorepo (apps/api, apps/mobile, packages/\*)
**Focus:** Comprehensive
**Iterations:** 30 (bounded)

## Summary

- **Total Findings:** 6 (1 retracted as false positive)
  - Critical: 0 | High: 0 | Medium: 2 | Low: 3 | Info: 1
- **STRIDE Coverage:** 6/6 categories tested
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 4 | Likely: 2 | Possible: 1

## Top Findings

1. [Session Error Code Differentiation](./findings.md#finding-1) — auth middleware leaks session state (expired vs invalid) via distinct error codes
2. [Unknown Session Type Idle Timeout](./findings.md#finding-2) — fallback to web timeout may not be the shortest available, violating fail-closed intent
3. [Session Count Race Condition](./findings.md#finding-3) — concurrent logins can exceed MAX_SESSIONS_PER_ACCOUNT limit

## Overall Assessment

The Pluralscape codebase demonstrates **strong security practices** with mature defense-in-depth controls. Key strengths:

- **Zero injection vectors:** All queries parameterized via Drizzle ORM, no shell execution, no HTML rendering
- **Comprehensive access control:** RLS on all ~80 tables, system ownership validation, bucket-scoped friend access
- **Strong cryptography:** Argon2id (OWASP-compliant), XChaCha20-Poly1305, BLAKE2b, proper memory zeroing
- **Multi-layer SSRF protection:** IP blocklist + DNS validation + IP pinning (prevents DNS rebinding)
- **Zero known dependency vulnerabilities:** Clean pnpm audit, proactive version overrides
- **Comprehensive audit logging:** 200+ event types, structured logging, no log injection vectors

The two medium findings are informational leakage issues that do not enable direct exploitation but should be addressed to strengthen the security posture.

## Coverage

```
STRIDE Coverage: S[x] T[x] R[x] I[x] D[x] E[x] — 6/6
OWASP Coverage: A01[x] A02[x] A03[x] A04[x] A05[x] A06[x] A07[x] A08[x] A09[x] A10[x] — 10/10
Findings: 0 Critical, 0 High, 2 Medium, 3 Low, 1 Info (1 retracted as false positive)
Confirmed: 4 | Likely: 2 | Possible: 0
Metric: (10/10)*50 + (6/6)*30 + min(6, 20) = 50 + 30 + 6 = 86/100
```

## Files in This Report

- [Threat Model](./threat-model.md) — STRIDE analysis, assets, trust boundaries
- [Attack Surface Map](./attack-surface-map.md) — entry points, data flows, abuse paths
- [Findings](./findings.md) — all findings ranked by severity
- [OWASP Coverage](./owasp-coverage.md) — per-category test results
- [Dependency Audit](./dependency-audit.md) — pnpm audit results and supply chain controls
- [Recommendations](./recommendations.md) — prioritized mitigations with code snippets
- [Iteration Log](./security-audit-results.tsv) — raw data from every iteration
