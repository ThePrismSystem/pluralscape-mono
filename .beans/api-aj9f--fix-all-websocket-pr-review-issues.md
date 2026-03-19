---
# api-aj9f
title: Fix all WebSocket PR review issues
status: in-progress
type: task
priority: normal
created_at: 2026-03-19T19:27:11Z
updated_at: 2026-03-19T19:27:19Z
parent: api-fh4u
---

Fix all 18 issues from multi-model PR review: 4 critical (prototype pollution, missing ACL), 7 important (silent failures, unhandled rejections), 7 suggestions (duplication, consolidation). 5 commits in dependency order.

## Checklist

- [ ] Commit 1: fix(api): prevent prototype pollution and add document access control
- [ ] Commit 2: fix(api): improve error handling across WebSocket subsystem
- [ ] Commit 3: refactor(api): eliminate as-never casts and fix type annotations
- [ ] Commit 4: fix(api): improve resource management and connection lifecycle
- [ ] Commit 5: refactor(api): consolidate handlers and deduplicate serialization
