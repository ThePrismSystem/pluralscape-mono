---
# api-aj9f
title: Fix all WebSocket PR review issues
status: completed
type: task
priority: normal
created_at: 2026-03-19T19:27:11Z
updated_at: 2026-03-19T19:56:26Z
parent: api-fh4u
---

Fix all 18 issues from multi-model PR review: 4 critical (prototype pollution, missing ACL), 7 important (silent failures, unhandled rejections), 7 suggestions (duplication, consolidation). 5 commits in dependency order.

## Checklist

- [x] Commit 1: fix(api): prevent prototype pollution and add document access control
- [x] Commit 2: fix(api): improve error handling across WebSocket subsystem
- [x] Commit 3: refactor(api): eliminate as-never casts and fix type annotations
- [x] Commit 4: fix(api): improve resource management and connection lifecycle
- [x] Commit 5: refactor(api): consolidate handlers and deduplicate serialization

## Summary of Changes

Fixed all 18 issues from the multi-model PR review across 5 commits:

1. Prototype pollution prevention (Object.hasOwn) + document ownership ACL
2. Error handling: ioredis error listeners, send() logging, resubscribe failure handling, narrowed catch, routeMessage .catch()
3. Eliminated 11 as-never casts (down to 2 documented boundary casts), typed MUTATION_MESSAGE_TYPES, fixed close code to RFC 6455
4. LRU eviction for relay, rate limit strikes, dead connection cleanup, Valkey connect timeout + status checks
5. Deduplicated serialization, consolidated 5 handler files into 1, eliminated manual envelope reconstruction
