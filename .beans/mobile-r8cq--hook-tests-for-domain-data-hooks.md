---
# mobile-r8cq
title: Hook tests for domain data hooks
status: todo
type: task
priority: normal
created_at: 2026-04-03T15:58:06Z
updated_at: 2026-04-03T15:58:06Z
parent: ps-0ph3
---

Write tests for all 59 domain data hooks in apps/mobile/src/hooks/. These are thin wrappers around tRPC queries with select transforms, enabled guards, and onSuccess cache invalidation. Requires mocking tRPC + React Query providers. Follow-up from PR #370 review.
