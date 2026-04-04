---
# mobile-r8cq
title: Hook tests for domain data hooks
status: completed
type: task
priority: normal
created_at: 2026-04-03T15:58:06Z
updated_at: 2026-04-04T05:00:47Z
parent: ps-0ph3
---

Write tests for all 59 domain data hooks in apps/mobile/src/hooks/. These are thin wrappers around tRPC queries with select transforms, enabled guards, and onSuccess cache invalidation. Requires mocking tRPC + React Query providers. Follow-up from PR #370 review.

## Summary of Changes

Created shared test infrastructure (renderHookWithProviders, test crypto helpers) and wrote render-level tests for all 20 domain hook files. Tests cover: query/mutation procedure args, select decryption with real crypto fixtures, enabled guard for null masterKey, mutation cache invalidation, subscription options. Uses module-level tRPC mocks with captured options pattern.
