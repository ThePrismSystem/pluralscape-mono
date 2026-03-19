---
# api-n2c5
title: Fix WebSocket PR review issues (round 2)
status: in-progress
type: task
priority: high
created_at: 2026-03-19T20:36:41Z
updated_at: 2026-03-19T21:06:06Z
parent: api-fh4u
---

Fix all 25 issues from multi-model PR review (Claude, Gemini, CodeQL): 3 critical security issues, 12 important issues, 10 suggestions. 8 commits in dependency order.

## Checklist

- [x] Commit 1: refactor(api): make SyncConnectionState a discriminated union
- [x] Commit 2: fix(api): close security vulnerabilities in auth and snapshot handling
- [x] Commit 3: fix(sync): use per-document sequence counters and fix LRU eviction
- [x] Commit 4: fix(api): improve resource management and connection lifecycle
- [ ] Commit 5: fix(api): harden Valkey pub/sub error handling
- [ ] Commit 6: refactor(api): add DI context, type guard, sliding window rate limiter, and dispatch helpers
- [ ] Commit 7: test(api): add handlers and serialization tests, fix fixture values
- [ ] Commit 8: test(api): expand E2E WebSocket coverage
