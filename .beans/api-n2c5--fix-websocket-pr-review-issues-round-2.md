---
# api-n2c5
title: Fix WebSocket PR review issues (round 2)
status: completed
type: task
priority: high
created_at: 2026-03-19T20:36:41Z
updated_at: 2026-03-19T21:38:43Z
parent: api-fh4u
---

Fix all 25 issues from multi-model PR review (Claude, Gemini, CodeQL): 3 critical security issues, 12 important issues, 10 suggestions. 8 commits in dependency order.

## Checklist

- [x] Commit 1: refactor(api): make SyncConnectionState a discriminated union
- [x] Commit 2: fix(api): close security vulnerabilities in auth and snapshot handling
- [x] Commit 3: fix(sync): use per-document sequence counters and fix LRU eviction
- [x] Commit 4: fix(api): improve resource management and connection lifecycle
- [x] Commit 5: fix(api): harden Valkey pub/sub error handling
- [x] Commit 6: refactor(api): add DI context, type guard, sliding window rate limiter, and dispatch helpers
- [x] Commit 7: test(api): add handlers and serialization tests, fix fixture values
- [x] Commit 8: test(api): expand E2E WebSocket coverage

## Summary of Changes

Fixed all 25 issues from multi-model PR review across 8 commits:

1. **Discriminated union** — SyncConnectionState is now a tagged union (AwaitingAuthState/AuthenticatedState/ClosingState) with compile-time safety on auth fields
2. **Security** — Removed friend auth bypass (system ownership required for all profiles), forced snapshot documentId override to match validated docId
3. **Per-document seq** — Replaced global sequence counter with per-document counters, fixed LRU self-eviction bug
4. **Resource management** — Close dead WebSockets before removing, Slowloris slot reservation pattern
5. **Valkey hardening** — Promise.allSettled resubscription, publish returns boolean, subscribe-then-track ordering
6. **DI + sliding window** — RouterContext replaces module singletons, type guard eliminates casts, sliding window rate limiter with interpolation
7. **Test coverage** — 36 new handler/serialization unit tests, bounded subscribe + mutation rate limit tests
8. **E2E coverage** — Subscribe+broadcast flow, over-limit subscribe rejection
