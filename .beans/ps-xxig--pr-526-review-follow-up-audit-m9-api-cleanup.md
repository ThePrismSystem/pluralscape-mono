---
# ps-xxig
title: "PR #526 review follow-up: audit-m9-api cleanup"
status: completed
type: task
priority: high
created_at: 2026-04-20T13:38:35Z
updated_at: 2026-04-20T14:15:00Z
parent: api-v8zu
---

Address 6 important + 7 suggestions + 4 test gaps from multi-agent review of PR #526 (audit-m9-api). Lands as 13 commits on top of `chore/audit-m9-api` (12 planned + 1 follow-up that fixes unit-test mocks rendered stale by commit 4's new pre-aggregate COUNT query).

## Checklist

### 1. Important Fixes

- [x] 1.1 Hoist cache invalidation out of transaction (notification-config.service.ts)
- [x] 1.2 Preserve `truncated` contract in analytics aggregation
- [x] 1.3 Clamp SUM(bigint) to Number.MAX_SAFE_INTEGER
- [x] 1.4 Throw on unhandled analytics subject type (no silent cast)
- [x] 1.5 Dedupe `toServerSecret` in tests (webhook-config.test.ts via importOriginal; common-route-mocks kept inline with explaining comment to avoid circular vi.mock evaluation)
- [x] 1.6 Add `toDuration()` factory in packages/types

### 2. Suggestions

- [x] 2.1 Remove dead `?? sql\`TRUE\`` in analytics
- [x] 2.2 Narrow `eventType` to FriendNotificationEventType
- [x] 2.3 Document abort granularity in blob-s3-cleanup
- [x] 2.4 Introduce `buildCacheKey` helper + domain prefixes
- [x] 2.5 Tighten/document i18n locale schema (documented — no static locale list source exists, CDN 404 is authoritative allowlist)
- [x] 2.6 Factor shared `withProdEnv` test helper
- [x] 2.7 Consolidate SSE wait helpers

### 3. Test Gaps

- [x] 3.1 Friend-dashboard quota branches (custom front / innerworld)
- [x] 3.2 Switch-alert mutation → invalidation wire
- [x] 3.3 blob-s3-cleanup abort between sub-batches
- [x] 3.4 Analytics `truncated` integration coverage

### Verification

- [x] pnpm -w typecheck (21/21 packages)
- [x] pnpm vitest run --project api (5344/5344)
- [x] pnpm vitest run --project api-integration (1243/1243) — plan referenced `api-slow`, that project is not defined in this repo
- [x] pnpm -w lint (17/17 successful)

## Summary of Changes

13 commits on top of origin/chore/audit-m9-api:

1. `36e44863` refactor(types): add toDuration factory
2. `eead0943` refactor(api): use toDuration/toServerSecret factories in tests and analytics
3. `20a63d0e` fix(api): throw on unhandled analytics subject type instead of silent cast
4. `54110f63` fix(api): preserve truncated contract and clamp SUM in analytics aggregation
5. `0a6a24d3` fix(api): remove dead drizzle or()-fallback in analytics filter
6. `8a5df476` fix(api): hoist switch-alert cache invalidation out of transaction
7. `e118812f` refactor(api): narrow switch-alert eventType to FriendNotificationEventType
8. `f377d04c` refactor(api): introduce buildCacheKey helper and domain prefixes
9. `ad41fb2b` docs(api): document S3 cleanup abort-between-subbatches semantics
10. `2a464181` refactor(api): document i18n locale/namespace regex scope
11. `e09b74d0` test(api): extract shared withProdEnv and async-wait helpers
12. `7c7d0eb9` test(api): fill coverage gaps from PR #526 review
13. `aaf032a0` test(api): mock pre-aggregate COUNT in analytics unit tests

## Deviations from Plan

- **1.5 (partial)**: common-route-mocks.ts kept inline `toServerSecret` cast with explaining comment. Importing the real helper triggers circular evaluation via the calling test file's `vi.mock(.../webhook-config.service.js, () => mockWebhookConfigServiceFactory())`. webhook-config.test.ts DOES use the real helper via `importOriginal` pattern.
- **2.5 accepted, not tightened**: no static locale list source in the codebase; Crowdin CDN manifest is authoritative. Closed with inline docs.
- **+1 extra commit**: commit 13 (`aaf032a0`) fixes three pre-existing unit tests whose mocks broke when commit 4 added the pre-aggregate COUNT query. Per CLAUDE.md feedback rules (never dismiss test failures as pre-existing), these had to be fixed in this PR before push.
- **Verification**: plan referenced `api-slow` project; no such project exists. Ran `api-integration` instead.
