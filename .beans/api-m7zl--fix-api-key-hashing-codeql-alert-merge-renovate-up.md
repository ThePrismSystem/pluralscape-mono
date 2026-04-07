---
# api-m7zl
title: Fix API key hashing CodeQL alert + merge Renovate updates
status: completed
type: task
priority: normal
created_at: 2026-04-07T01:56:26Z
updated_at: 2026-04-07T02:05:00Z
---

Change API key token hashing from plain SHA-256 to HMAC-SHA256 with server-side key to resolve CodeQL js/insufficient-password-hash alert. Also merge Renovate PRs #393 (AWS SDK) and #394 (vitest-mock-extended v4).

## Summary of Changes

- Changed API key token hashing from plain SHA-256 to HMAC-SHA256 with server-side key (`API_KEY_HMAC_KEY`)
- Added `API_KEY_HMAC_KEY` env var to `env.ts` (required in production, optional in dev/test with deterministic fallback)
- Updated `.env.example` with the new variable
- Updated `env-rate-limit-guard.test.ts` to set the new env var in production mode tests
- Updated test description from SHA-256 to HMAC-SHA256
- Merged Renovate PRs: AWS SDK v3.1025.0 (#393), vitest-mock-extended v4 (#394)
