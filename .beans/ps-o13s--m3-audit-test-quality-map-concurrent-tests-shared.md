---
# ps-o13s
title: "M3 audit test quality: map-concurrent tests, shared crypto fixtures, unique IDs, valkey-pubsub reconnection"
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:06:27Z
updated_at: 2026-03-21T03:25:00Z
parent: ps-irrf
---

## Summary of Changes

Implements 4 M3 audit findings (T-H1, T-M1, T-M2, T-M3):

- **T-H1**: Created `packages/sync/src/__tests__/map-concurrent.test.ts` with comprehensive tests for the `mapConcurrent` utility (empty input, single item, serial execution, concurrency limits, rejection handling, result ordering, zero-limit edge case)
- **T-M1**: Created `apps/api/src/__tests__/helpers/crypto-test-fixtures.ts` exporting `nonce()`, `pubkey()`, `sig()`, `makeEnvelope()`, `makeSnapshotEnvelope()`. Updated 6 test files to import from the shared helper, removing duplicated local definitions
- **T-M2**: Replaced hardcoded `"acct_test"`, `"sys_test"`, `"sess_test"` with `crypto.randomUUID()`-based IDs in `connection-manager.test.ts` and `auth-handler.test.ts`, following the pattern from `graceful-shutdown.test.ts`
- **T-M3**: Added ValkeyPubSub reconnection tests: message delivery after reconnect, error event resilience on subscriber and publisher, unsubscribe during reconnection cleanup, and publish failure during disconnected state
