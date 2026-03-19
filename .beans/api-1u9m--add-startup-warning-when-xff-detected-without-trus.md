---
# api-1u9m
title: Add warning when XFF detected without TRUST_PROXY
status: todo
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-19T11:39:43Z
parent: api-765x
---

L6: Log a warning on the first request containing X-Forwarded-For headers when TRUST_PROXY is not configured.

## Acceptance Criteria

- On first request with X-Forwarded-For header, if TRUST_PROXY not configured → log warning once
- Warning includes: header detected, recommendation to set TRUST_PROXY
- Warning logged at most once per server lifecycle (not per request)
- No warning when TRUST_PROXY is configured
- Unit test: XFF without config → warning logged; with config → no warning
