---
# api-xbss
title: Fix PR review issues for api-hardening-audit-013-remaining
status: completed
type: task
priority: normal
created_at: 2026-03-20T19:20:55Z
updated_at: 2026-03-20T19:25:48Z
---

Address all 10 issues from PR review: TOCTOU cache invalidation, sparse fieldset types, CORS null return, filterFields overloads, origin matcher docs, QueryCache.size rename, S3 pattern JSDoc, bean formatting, sparse fieldset route tests, cache integration tests

## Summary of Changes

All 10 PR review findings addressed:

1. Moved cache invalidation outside transaction callbacks in field-definition.service.ts (5 sites) and system-settings.service.ts (1 site)
2. Added `satisfies readonly (keyof ResultType)[]` to sparse field arrays in fields/list.ts, groups/list.ts, members/list.ts
3. Changed CORS callback to return `null` instead of empty string for disallowed origins
4. Added overload signatures to `filterFields` for type-precise return types
5. Documented scheme-agnostic wildcard behavior in origin-matcher.ts JSDoc
6. Renamed `QueryCache.size` to `approximateSize` to clarify it includes expired entries
7. Expanded JSDoc on `AWS_SECRET_KEY_PATTERN` noting its scope limitation
8. Fixed literal backslash-n in 15 bean files' Summary/Deferred/Scrapping sections
9. Added 3 sparse fieldset route tests per list endpoint (fields, groups, members)
10. Added cache lifecycle integration tests for field-definition and system-settings services
