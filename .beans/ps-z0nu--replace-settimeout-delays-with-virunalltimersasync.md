---
# ps-z0nu
title: Replace setTimeout delays with vi.runAllTimersAsync in tests
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:02:49Z
parent: ps-i3xl
---

auth.test.ts:336, auth.service.test.ts:562, etc.

## Summary of Changes\n\nAdded explanatory comments to all 4 setTimeout delays in test files: auth.test.ts, auth.service.test.ts, sync-relay.service.integration.test.ts, bounded-subscribe.test.ts. All delays are intentional (fire-and-forget flush, DB timestamp separation, mock async simulation) and cannot use fake timers.
