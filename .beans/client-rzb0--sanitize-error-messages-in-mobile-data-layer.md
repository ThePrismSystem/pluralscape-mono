---
# client-rzb0
title: Sanitize error messages in mobile data layer
status: completed
type: task
priority: normal
created_at: 2026-04-14T06:39:56Z
updated_at: 2026-04-14T07:18:56Z
parent: ps-9ujv
---

**Finding 4 (Low)** — OWASP A05, STRIDE Information Disclosure

`packages/data/src/rest-query-factory.ts:58` stringifies raw API error JSON into thrown errors. If propagated to UI or crash reports, this could reveal internal API structure.

**Fix:** Replace raw JSON stringification with a structured `ApiClientError` class that exposes only code and message, not full error details.

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-4

## Summary of Changes

Created ApiClientError class in packages/data/src/api-client-error.ts.
Updated unwrap() in rest-query-factory.ts to throw ApiClientError with
only code and message. Exported from package barrel.
