# Security Audit — Comprehensive STRIDE + OWASP Full Audit

**Date:** 2026-03-18 16:26
**Scope:** Full codebase (apps/api, packages/crypto, packages/db, packages/storage, packages/queue, packages/validation, packages/types)
**Focus:** Comprehensive — all STRIDE categories and OWASP Top 10
**Iterations:** 24
**Mode:** Unbounded (autonomous loop)

## Summary

- **Total Findings:** 7 actionable (excluding Info-level positive confirmations)
  - Critical: 0 | High: 0 | Medium: 3 | Low: 4 | Info: 30+ (positive confirmations)
- **STRIDE Coverage:** 6/6 categories tested
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 5 | Likely: 2 | Possible: 0

## Overall Assessment

The codebase continues to mature. **6 of 8 findings from the previous audit (March 17) have been fully resolved**, including all the significant infrastructure fixes. The ZodError production leak is fixed, encrypted payload bounds are enforced, password schema consistency is improved, IP validation is in place, and rate limit category collisions are eliminated.

Remaining findings are Medium and Low severity, focused on timing side-channels and defense-in-depth refinements. No critical or high-severity vulnerabilities were found.

The **cryptographic layer remains excellent** — strong algorithm choices, consistent key zeroing, proper KDF context separation, authenticated encryption, and envelope encryption patterns.

## Top Findings

1. **[MEDIUM] Login Timing Side-Channel** — Audit write on "invalid password" path creates measurable timing delta vs "not found" path ([findings.md](./findings.md#medium-finding-1-login-timing-side-channel-via-audit-write))
2. **[MEDIUM] Password Reset Path Differentiation** — Different error paths for "no account" vs "no recovery key" ([findings.md](./findings.md#medium-finding-2-password-reset-path-differentiation))
3. **[MEDIUM] Password Max Length Missing** — Registration and change-password schemas lack `.max(MAX_PASSWORD_LENGTH)` ([findings.md](./findings.md#medium-finding-3-registration-and-change-password-schemas-missing-password-max-length))

## Historical Comparison

**Previous audit:** security/260317-1144-stride-owasp-full-audit/ (1 day ago)

### Trend

| Metric           | Previous | Current | Change                     |
| ---------------- | -------- | ------- | -------------------------- |
| Critical         | 0        | 0       | --                         |
| High             | 0        | 0       | --                         |
| Medium           | 3        | 3       | -- (different composition) |
| Low              | 5        | 4       | Improved (-1)              |
| Total actionable | 8        | 7       | Improved (-1)              |
| OWASP coverage   | 10/10    | 10/10   | --                         |
| STRIDE coverage  | 6/6      | 6/6     | --                         |

### Finding Status

| Status                 | Count | Details                                                                                                         |
| ---------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Fixed since last audit | 6     | ZodError leak, unbounded encryptedData, IP validation, password schema min, rate limit categories, Valkey store |
| New findings           | 3     | Login timing, password reset timing, password max length                                                        |
| Recurring (unfixed)    | 4     | Webhook secret T3, audit PII, transfer code entropy, session revocation TOCTOU (improved)                       |

### Assessment

The previous audit's three Medium findings are all resolved. New Medium findings are timing side-channels and a validation consistency gap — both lower risk than the previous findings. The Low count decreased by 1 (password schema inconsistency fixed). Session revocation TOCTOU is improved (accountId now in WHERE clause) but the pre-transaction check remains as dead code.

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

| Category               | Tested | Findings                                            |
| ---------------------- | ------ | --------------------------------------------------- |
| Spoofing               | Yes    | 1 (Low — transfer code entropy, recurring)          |
| Tampering              | Yes    | 0                                                   |
| Repudiation            | Yes    | 0                                                   |
| Information Disclosure | Yes    | 4 (2 Medium timing, 1 Low webhook, 1 Low audit PII) |
| Denial of Service      | Yes    | 1 (Medium — password max length)                    |
| Elevation of Privilege | Yes    | 1 (Low — session revocation TOCTOU, improved)       |

### OWASP Top 10

| Category                      | Status                                 |
| ----------------------------- | -------------------------------------- |
| A01 Broken Access Control     | Partial (session revocation dead code) |
| A02 Cryptographic Failures    | Partial (recurring design trade-offs)  |
| A03 Injection                 | Pass                                   |
| A04 Insecure Design           | Partial (password max length gap)      |
| A05 Security Misconfiguration | Pass (ZodError FIXED, headers correct) |
| A06 Vulnerable Components     | Pass (0 CVEs)                          |
| A07 Auth Failures             | Partial (timing side-channels)         |
| A08 Data Integrity            | Pass                                   |
| A09 Logging Failures          | Partial (PII retention)                |
| A10 SSRF                      | Pass                                   |

## Metric

```
owasp_tested = 10/10
stride_tested = 6/6
findings = 7

metric = (10/10)*50 + (6/6)*30 + min(7, 20) = 50 + 30 + 7 = 87/100
```

## Key Strengths

- Full auth middleware stack (session-based, no JWT)
- E2E encryption with XChaCha20-Poly1305 + Ed25519
- KEK/DEK master key wrapping (survives password reset)
- Anti-timing + anti-enumeration on login and registration
- Fail-closed RLS policies for PostgreSQL multi-tenancy
- Comprehensive audit event taxonomy (21 event types)
- Tiered privacy model (T1 zero-knowledge, T2 per-bucket, T3 server-readable)
- Proper key lifecycle management with memzero
- Clean dependency posture (0 CVEs, Dependabot)
- Multi-layer path traversal protection in storage
- Session revocation on password change
- ZodError production masking (fixed since last audit)
- Rate limit category isolation (fixed since last audit)
- Valkey store lazy resolution (fixed since last audit)
- Per-field encrypted payload size bounds (fixed since last audit)
