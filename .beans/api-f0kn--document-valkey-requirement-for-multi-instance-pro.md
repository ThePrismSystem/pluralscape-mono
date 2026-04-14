---
# api-f0kn
title: Document Valkey requirement for multi-instance production
status: completed
type: task
priority: normal
created_at: 2026-04-14T06:39:52Z
updated_at: 2026-04-14T07:18:53Z
parent: ps-9ujv
---

**Finding 3 (Low)** — OWASP A04, STRIDE DoS/Spoofing

In-memory rate limit and login throttle stores are process-local. Without Valkey, multi-instance deployments allow rate limit bypass via request distribution across instances.

**Fix:**

1. Add startup warning when Valkey unavailable in production
2. Document Valkey as required for multi-instance production in deployment docs

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-3

## Summary of Changes

Added production warning in apps/api/src/index.ts when VALKEY_URL not
configured, consistent with existing SSE and sync pub/sub warnings.
