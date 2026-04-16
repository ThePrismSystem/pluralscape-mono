---
# ps-9ujv
title: Security Audit Remediation (2026-04-14)
status: completed
type: epic
priority: normal
created_at: 2026-04-14T06:39:38Z
updated_at: 2026-04-16T07:29:55Z
parent: ps-h2gl
---

Remediate findings from the 2026-04-14 STRIDE+OWASP full security audit. Report: security/260414-0126-stride-owasp-full-audit/overview.md. 7 findings: 0 Critical, 0 High, 2 Medium, 2 Low, 3 Info.

## Summary of Changes

All 8 beans remediated:

- api-wdba: Per-system quotas for notes (5000), entities (500), regions (100), canvases (50)
- api-g4c6: 250 MB file size limit on SP and PK import parsers (shared via import-core)
- api-f0kn: Production warning when Valkey unavailable for rate limiting
- client-rzb0: ApiClientError replaces raw JSON in rest-query-factory
- client-ziee: retryLink for tRPC + retry middleware for REST client on 429
- api-si8q: Accepted (session lastActive TOCTOU)
- api-j0se: Accepted (queue job integrity)
- api-wlh6: Already documented (webhook HMAC timing-safe comparison)
