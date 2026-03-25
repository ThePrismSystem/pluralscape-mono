# Security Audit — Comprehensive STRIDE + OWASP Full Audit

**Date:** 2026-03-24 21:24
**Scope:** Full monorepo (apps/api, packages/crypto, packages/db, packages/storage, packages/queue, packages/sync, packages/types, packages/rotation-worker)
**Focus:** Comprehensive — all STRIDE categories and OWASP Top 10
**Iterations:** 8 (bounded)

## Summary

- **Total Findings:** 12 actionable
  - Critical: 0 | High: 1 | Medium: 7 | Low: 4 | Info: 0
- **STRIDE Coverage:** 6/6 categories tested
- **OWASP Coverage:** 10/10 categories tested
- **Confirmed:** 10 | Likely: 2 | Possible: 1
- **Metric:** 95/100

## Overall Assessment

Pluralscape's security posture has **improved dramatically** since the previous audit (2026-03-15). The API layer — previously the primary risk area with no auth, CORS, rate limiting, or security headers — now implements comprehensive security middleware. The cryptographic layer remains excellent.

**Key strengths:**

- E2E encryption with libsodium (XChaCha20-Poly1305, Ed25519, Argon2id)
- 15 rate limit categories with Valkey-backed sliding windows
- Comprehensive auth middleware with session hash-only storage
- Zod validation on all input boundaries
- Fail-closed RLS policies (if activated)
- Anti-enumeration timing on registration
- Comprehensive SSRF protection on webhooks
- Zero dependency CVEs
- SHA-pinned GitHub Actions with frozen lockfile

**Primary risk area:** Defense-in-depth activation (RLS context not set at runtime), and several timing/race condition findings in the auth layer.

## Top 3 Findings

1. [**[HIGH] RLS Policies Not Activated**](./findings.md#high-finding-1-rls-policies-defined-but-never-activated-at-runtime) — 66 RLS policies deployed but never receive tenant context from API layer
2. [**[MEDIUM] WebSocket Connection DoS**](./findings.md#medium-finding-5-websocket-global-unauthed-connection-cap-without-per-ip-tracking) — Global unauthed cap without per-IP tracking enables Slowloris
3. [**[MEDIUM] Biometric Token Replay**](./findings.md#medium-finding-4-biometric-token-replay--no-single-use-enforcement) — Tokens not consumed after use, enabling replay attacks

## Historical Comparison

**Previous audit:** `security/260315-0835-stride-owasp-full-audit/` (9 days ago)

### Trend

| Metric             | Previous | Current | Change                                  |
| ------------------ | -------- | ------- | --------------------------------------- |
| Critical           | 0        | 0       | → 0                                     |
| High               | 1        | 1       | → 0 (different finding)                 |
| Medium             | 6        | 7       | ↑ +1 (deeper analysis found new issues) |
| Low                | 2        | 4       | ↑ +2                                    |
| Total (actionable) | 8        | 13      | ↑ +5 (more thorough audit)              |
| OWASP coverage     | 10/10    | 10/10   | →                                       |
| STRIDE coverage    | 6/6      | 6/6     | →                                       |

### Finding Status

| Status                 | Count | Details                                                                            |
| ---------------------- | ----- | ---------------------------------------------------------------------------------- |
| Fixed since last audit | 6     | Auth middleware, rate limiting, CORS, error handler, SQLite FK, password policy    |
| New findings           | 12    | RLS activation, timing attacks, race conditions, biometric replay, WS DoS, headers |
| Partially recurring    | 1     | Security headers (most fixed, 2 still missing)                                     |
| Accepted risk          | 1     | Webhook secret stored as T3 (design trade-off, unchanged)                          |

### Regression Alert

The 6 fixed findings from the previous audit demonstrate significant security improvement. The 12 new findings are primarily deeper-layer issues (timing, races, defense-in-depth) that were not testable when the API layer didn't exist.

## Coverage Matrix

### STRIDE

| Category               | Tested | Findings                                                         |
| ---------------------- | ------ | ---------------------------------------------------------------- |
| Spoofing               | Yes    | 4 (timing enumeration, biometric replay, fake key, reset timing) |
| Tampering              | Yes    | 3 (blob race, webhook race, envelope verification)               |
| Repudiation            | Yes    | 1 (rotation sealing race — duplicate audit events)               |
| Information Disclosure | Yes    | 1 (missing headers)                                              |
| Denial of Service      | Yes    | 2 (WS connection cap, session limit)                             |
| Elevation of Privilege | Yes    | 1 (RLS not activated)                                            |

### OWASP Top 10

| Category                      | Status                                                    |
| ----------------------------- | --------------------------------------------------------- |
| A01 Broken Access Control     | ⚠️ RLS not activated (app-layer checks solid)             |
| A02 Cryptographic Failures    | ✅ Strong crypto implementation                           |
| A03 Injection                 | ✅ Clean (no injection vectors)                           |
| A04 Insecure Design           | ⚠️ Race conditions, session limits                        |
| A05 Security Misconfiguration | ⚠️ 2 missing headers                                      |
| A06 Vulnerable Components     | ✅ Clean (0 CVEs)                                         |
| A07 Auth Failures             | ⚠️ Timing enumeration, biometric replay                   |
| A08 Data Integrity            | ⚠️ Envelope verification toggle (low risk); CodeQL active |
| A09 Logging Failures          | ✅ Strong (80+ events, structured logging)                |
| A10 SSRF                      | ✅ Clean (comprehensive protection)                       |

## Files in This Report

- [Threat Model](./threat-model.md) — STRIDE analysis, assets, trust boundaries
- [Attack Surface Map](./attack-surface-map.md) — entry points, data flows, abuse paths
- [Findings](./findings.md) — all findings ranked by severity
- [OWASP Coverage](./owasp-coverage.md) — per-category test results
- [Dependency Audit](./dependency-audit.md) — known CVEs in dependencies
- [Recommendations](./recommendations.md) — prioritized mitigations with code snippets
- [Iteration Log](./security-audit-results.tsv) — raw data from every iteration
