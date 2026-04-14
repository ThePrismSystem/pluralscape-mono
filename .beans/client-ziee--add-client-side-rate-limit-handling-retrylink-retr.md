---
# client-ziee
title: Add client-side rate limit handling (retryLink + Retry-After)
status: completed
type: task
priority: normal
created_at: 2026-04-14T06:52:31Z
updated_at: 2026-04-14T07:22:16Z
parent: ps-9ujv
---

**Discovered during security audit remediation investigation.**

The tRPC client has no `retryLink` — 429 responses fall through to React Query's generic retry with no Retry-After header parsing. The REST client wrapper (`packages/api-client/`) has zero retry or rate-limit awareness.

Components with proper 429 handling: import-sp API source (5 retries + backoff), sync offline queue (3 retries + backoff + jitter).

**Fix:**

1. Add tRPC `retryLink` to `apps/mobile/src/providers/trpc-provider.tsx` that respects Retry-After headers
2. Add rate-limit-aware retry logic to `packages/api-client/`

Reference: security/260414-0126-stride-owasp-full-audit/ (discovered during remediation planning)

## Summary of Changes

- Added `retryLink` to `apps/mobile/src/providers/trpc-provider.tsx`: retries up to 3 times on `TOO_MANY_REQUESTS` (httpStatus 429 or tRPC code).
- Added `onResponse` middleware to `packages/api-client/src/index.ts`: retries 429 responses once after parsing `Retry-After` header (defaults to 1s delay).

## Summary of Changes

- Added retryLink to tRPC client (trpc-provider.tsx) — retries TOO_MANY_REQUESTS up to 3 times
- Added onResponse middleware to REST client (api-client/index.ts) — single retry on 429 with Retry-After parsing
