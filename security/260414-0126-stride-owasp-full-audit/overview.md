# Security Audit — Comprehensive STRIDE + OWASP Full Audit

**Date:** 2026-04-14 01:26
**Scope:** Full monorepo (apps/api, packages/\*, apps/mobile data layer)
**Focus:** Comprehensive
**Iterations:** 30 vectors tested
**Auditor:** Automated security analysis

## Summary

- **Total Findings:** 7
  - Critical: 0 | High: 0 | Medium: 2 | Low: 2 | Info: 3
- **STRIDE Coverage:** 6/6 categories tested (S, T, R, I, D, E)
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 3 | Likely: 1 | Possible: 3

## Top Findings

1. [Missing Per-System Quotas for Notes/Innerworld](./findings.md#finding-1) — authenticated user can create unbounded entities (Medium)
2. [Import Parser Memory Exhaustion](./findings.md#finding-2) — large SP export files can cause OOM (Medium)
3. [In-Memory Stores Not Shared](./findings.md#finding-3) — rate limits bypassable in multi-instance without Valkey (Low)
4. [Error Message Leakage in Mobile](./findings.md#finding-4) — raw API errors in thrown exceptions (Low)

## Historical Comparison

**Previous audit:** security/260406-0808-stride-owasp-full-audit/ (8 days ago)

### Trend

| Metric          | Previous | Current | Change        |
| --------------- | -------- | ------- | ------------- |
| Critical        | 0        | 0       | --            |
| High            | 1        | 0       | Improved (-1) |
| Medium          | 2        | 2       | --            |
| Low             | 2        | 2       | --            |
| Info            | 2        | 3       | +1            |
| Total           | 7        | 7       | --            |
| OWASP coverage  | 10/10    | 10/10   | --            |
| STRIDE coverage | 6/6      | 6/6     | --            |

### Finding Status

| Status                    | Count | Details                                                                                                 |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| Fixed since last audit    | 5     | SMTP plaintext guard, CSP hardened, DNS rebinding IP pinning, API key auth, recovery rate limit         |
| New findings              | 5     | Quotas (notes/innerworld), import parser DoS, multi-instance stores, error leakage, webhook timing docs |
| Recurring (unfixed)       | 1     | Session lastActive TOCTOU (accepted)                                                                    |
| Previously false positive | 1     | Session revocation audit (was already implemented)                                                      |

### Security Posture Assessment

The codebase demonstrates **excellent security engineering**:

- **Cryptography:** Industry-standard libsodium primitives, OWASP-compliant Argon2id, proper key lifecycle (generation, wrapping, rotation, zeroing)
- **Access Control:** Multi-layer defense (RLS + system ownership + scope gate + friend access validation), fail-closed on all paths
- **Input Validation:** Zod schemas on all endpoints, parameterized queries, no raw SQL with user input
- **Anti-Enumeration:** Timing equalization with dummy crypto work on all auth failure paths
- **SSRF Protection:** DNS resolution + comprehensive IP blocklist + IP pinning (DNS rebinding prevention)
- **Rate Limiting:** Category-based with per-account login throttle, Valkey-backed shared state
- **Security Headers:** Restrictive CSP, HSTS with preload, Permissions-Policy, X-Frame-Options DENY
- **Supply Chain:** All CI actions pinned by SHA, dependency audit in pipeline, frozen lockfile
- **Zero-Knowledge Design:** Server never sees plaintext user data; E2E encryption throughout

The remaining findings are all Low/Medium severity with straightforward mitigations. No Critical or High vulnerabilities were identified.

## Files in This Report

- [Threat Model](./threat-model.md) — STRIDE analysis, assets, trust boundaries
- [Attack Surface Map](./attack-surface-map.md) — entry points, data flows, abuse paths
- [Findings](./findings.md) — all findings ranked by severity
- [OWASP Coverage](./owasp-coverage.md) — per-category test results
- [Dependency Audit](./dependency-audit.md) — known CVEs in dependencies
- [Recommendations](./recommendations.md) — prioritized mitigations
- [Iteration Log](./security-audit-results.tsv) — raw data from every iteration
