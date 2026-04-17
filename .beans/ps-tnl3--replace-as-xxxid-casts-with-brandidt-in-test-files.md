---
# ps-tnl3
title: Replace as-XxxId casts with brandId<T>() in test files
status: in-progress
type: task
priority: normal
created_at: 2026-04-16T09:34:35Z
updated_at: 2026-04-17T07:11:49Z
parent: ps-0enb
---

Mechanical replacement of `as XxxId` type casts with `brandId<XxxId>()` in all test files across the monorepo. Deferred from PR #453 review.

## Out of Scope / Flagged

- `apps/api-e2e/src/tests/websocket/sync-ws.spec.ts:71` (`"sys_test" as SystemId`) — an E2E Playwright spec outside the specified glob. Left untouched per instructions; safe to address in a follow-up if desired.
- `packages/sync/src/document-types.ts:154` (`} as ParsedDocumentId;`) — source (non-test) code, intentional widening over an object literal, out of scope.
