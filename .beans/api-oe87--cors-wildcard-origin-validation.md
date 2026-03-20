---
# api-oe87
title: CORS wildcard origin validation
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T18:58:58Z
parent: api-765x
---

M12: Validate CORS origin against an allowlist instead of reflecting the request origin.

## Acceptance Criteria

- CORS origin validated against configured allowlist (env var or config)
- Allowed origin → Access-Control-Allow-Origin set to that origin
- Disallowed origin → no CORS headers in response
- Allowlist supports exact match and optional wildcard subdomains
- Integration tests: request from allowed origin → headers present; disallowed → no headers

## Summary of Changes

Implemented as part of feat/api-hardening-audit-013-remaining.
