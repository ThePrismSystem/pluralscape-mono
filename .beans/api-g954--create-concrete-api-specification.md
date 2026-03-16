---
# api-g954
title: Create concrete API specification
status: completed
type: task
priority: high
created_at: 2026-03-09T12:13:37Z
updated_at: 2026-03-16T09:07:26Z
parent: ps-rdqo
---

Create an API specification (OpenAPI or similar) that concretely defines: rate limits with specific thresholds, error codes per endpoint, pagination behavior, retry semantics with formulas/max retries/DLQ specs, session timeout durations, media upload quotas, friend code TTL, audit log retention policy. Current docs say 'exponential backoff' and 'intelligent backoff' without any numbers.

Source: Architecture Audit 004, Metric 3

## Summary of Changes

Created concrete API specification with 8 sections covering rate limits, error codes, pagination, retry semantics, session timeouts, media quotas, friend code TTL, and audit log retention. All values are cross-referenced against existing codebase.

### Deliverables

- `docs/planning/api-specification.md` — full spec document with rationale
- `packages/types/src/api-constants.ts` — importable constants (exported from barrel)

### Follow-up beans created

- api-77rx: Restructure error handler to new ApiErrorResponse format
- api-u3jt: Add jitterFraction 0.2 to default retry policies
- api-le53: Wire per-category rate limit middleware
- api-pfbj: Enforce pagination cursor TTL expiry
