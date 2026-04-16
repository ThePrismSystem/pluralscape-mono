---
# api-ao1s
title: Reduce over-mocking in webhook-dispatcher unit test
status: scrapped
type: task
priority: low
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-04-16T06:29:46Z
parent: ps-4ioj
---

webhook-dispatcher.test.ts mocks drizzle-orm primitives (and, eq, or, etc.) making tests unable to verify correct query construction.
