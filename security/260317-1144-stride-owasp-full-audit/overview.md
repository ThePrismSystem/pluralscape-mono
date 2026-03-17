# Security Audit — Comprehensive STRIDE + OWASP Full Audit

**Date:** 2026-03-17 11:44
**Scope:** Full codebase (apps/api, packages/crypto, packages/db, packages/sync, packages/storage, packages/queue, packages/validation, packages/types)
**Focus:** Comprehensive — all STRIDE categories and OWASP Top 10
**Iterations:** 24
**Mode:** Unbounded (autonomous loop)

## Summary

- **Total Findings:** 8 actionable (excluding Info-level positive confirmations)
  - Critical: 0 | High: 0 | Medium: 3 | Low: 5 | Info: 24 (positive confirmations)
- **STRIDE Coverage:** 6/6 categories tested
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 7 | Likely: 1 | Possible: 0

## Overall Assessment

The API layer has matured significantly since the previous audit (March 15). All 6 critical infrastructure gaps identified previously are now resolved: authentication middleware, security headers, rate limiting, CORS, global error handling, and SQLite foreign key enforcement.

The **cryptographic layer remains excellent** — strong algorithm choices, consistent key zeroing, proper KDF context separation, and authenticated encryption throughout.

Remaining findings are Medium or Low severity and primarily defense-in-depth improvements rather than directly exploitable vulnerabilities.

## Top Findings

1. **[MEDIUM] ZodError Details Leak in Production** — 400 responses include full validation error details ([findings.md](./findings.md#medium-finding-1-zoderror-details-leak-in-production-responses))
2. **[MEDIUM] Unbounded encryptedData String** — No `.max()` on encrypted payload field ([findings.md](./findings.md#medium-finding-2-unbounded-encrypteddata-string-in-system-update-schema))
3. **[MEDIUM] Session Revocation TOCTOU** — Missing accountId in UPDATE WHERE clause ([findings.md](./findings.md#medium-finding-3-session-revocation-toctou-defense-in-depth-gap))

## Historical Comparison

**Previous audit:** security/260315-0835-stride-owasp-full-audit/ (2 days ago)

### Trend

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Critical | 0 | 0 | -- |
| High | 1 | 0 | Improved (-1) |
| Medium | 6 | 3 | Improved (-3) |
| Low | 2 | 5 | Regressed (+3 new, 2 recurring) |
| Total actionable | 8 | 8 | -- (different composition) |
| OWASP coverage | 10/10 | 10/10 | -- |
| STRIDE coverage | 6/6 | 6/6 | -- |

### Finding Status

| Status | Count | Details |
|--------|-------|---------|
| Fixed since last audit | 6 | Auth middleware, security headers, rate limiting, CORS, SQLite FK, error handler |
| New findings | 5 | ZodError leak, unbounded encryptedData, session TOCTOU, IP validation, password schema |
| Recurring (unfixed) | 3 | Webhook secret T3, audit PII, transfer code entropy |

### Assessment

6 of 8 previous findings have been addressed. The API went from having no security infrastructure to a well-layered middleware stack. New findings are lower severity (Medium/Low) and represent refinement rather than fundamental gaps.

## Files in This Report

- [Threat Model](./threat-model.md) — STRIDE analysis, assets, trust boundaries
- [Attack Surface Map](./attack-surface-map.md) — entry points, data flows, abuse paths
- [Findings](./findings.md) — all findings ranked by severity
- [OWASP Coverage](./owasp-coverage.md) — per-category test results
- [Dependency Audit](./dependency-audit.md) — known CVEs in dependencies
- [Recommendations](./recommendations.md) — prioritized mitigations with code snippets
- [Iteration Log](./security-audit-results.tsv) — raw data from every iteration

## Coverage Matrix

### STRIDE

| Category | Tested | Findings |
|----------|--------|----------|
| Spoofing | Yes | 2 (IP validation, password schema) |
| Tampering | Yes | 1 (unbounded encryptedData) |
| Repudiation | Yes | 0 |
| Information Disclosure | Yes | 3 (ZodError leak, webhook secret, audit PII) |
| Denial of Service | Yes | 1 (rate-limit bucket flooding) |
| Elevation of Privilege | Yes | 1 (session revocation TOCTOU) |

### OWASP Top 10

| Category | Status |
|----------|--------|
| A01 Broken Access Control | Partial (defense-in-depth gap in session revocation) |
| A02 Cryptographic Failures | Partial (recurring design trade-offs) |
| A03 Injection | Partial (no SQL/XSS; unbounded input field) |
| A04 Insecure Design | Pass |
| A05 Security Misconfiguration | Partial (ZodError leak, IP validation) |
| A06 Vulnerable Components | Pass (0 CVEs) |
| A07 Auth Failures | Partial (schema inconsistency) |
| A08 Data Integrity | Pass |
| A09 Logging Failures | Partial (PII retention) |
| A10 SSRF | Pass |

## Metric

```
owasp_tested = 10/10
stride_tested = 6/6
findings = 8

metric = (10/10)*50 + (6/6)*30 + min(8, 20) = 50 + 30 + 8 = 88/100
```

## Key Strengths

- Full auth middleware stack (session-based, no JWT)
- E2E encryption with XChaCha20-Poly1305 + Ed25519
- KEK/DEK master key wrapping (survives password reset)
- Anti-timing + anti-enumeration on login and registration
- Fail-closed RLS policies for PostgreSQL multi-tenancy
- Optimistic locking with version fields for concurrency control
- Comprehensive audit event taxonomy (21 event types)
- Tiered privacy model (T1 zero-knowledge, T2 per-bucket, T3 server-readable)
- Proper key lifecycle management with memzero
- Clean dependency posture (0 CVEs, Dependabot, CodeQL)
- Multi-layer path traversal protection in storage
- Session revocation on password change
