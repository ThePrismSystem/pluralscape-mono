---
# infra-2o3p
title: "Fix all PR #118 review findings (24 items)"
status: completed
type: task
priority: normal
created_at: 2026-03-15T20:05:47Z
updated_at: 2026-03-15T20:46:31Z
---

Address 4 critical, 9 important, and 11 suggestion findings from PR #118 multi-agent review. 8 sequential commits covering: logger/empty-catches/fireHook (C2,C3,I8), idempotency TTL (C1), retry attempts reset (C4), performance/resilience (I5,I10,I11), worker fixes (I7,I9,I12,I13), type refinements (S17,S18,S24), dead code/tests/observability (S14,S15,S20,S21), backoff jitter/asPromise (S22,S23).

## Summary of Changes

Addressed all 24 PR #118 review findings across 8 logical change sets:

1. **Foundation (C2, C3, I8):** Added optional logger to BullMQJobQueue, replaced 3 empty catches with logged warnings, changed all fireHook calls from void to await with logger passthrough
2. **Idempotency TTL (C1):** Added 60s TTL to idempotency reservation keys, wrapped key update in try/catch with cleanup
3. **Reset attempts on retry (C4):** All 3 adapters now reset attempts to 0 on retry, with contract test
4. **Performance + resilience (I5, I10, I11):** Replaced redis.keys with scanKeys in obliterate, optimized countJobs with native BullMQ counts, health service uses Promise.allSettled with errors array
5. **Worker fixes (I7, I9, I12, I6):** Added logger to InMemoryJobWorker, clock injection to BullMQJobWorker, renamed ConsoleJobLogger to DevConsoleLogger (removed old name), documented dequeue ordering limitation
6. **Type refinements (S17, S18, S24):** Added JobAction union type, fireHook overload signatures, extracted DEFAULT_TIMEOUT_MS to queue.constants.ts
7. **Dead code + tests + observability (S14, S15, S20, S21):** Removed toStoredData, removed dlq/alerts.ts, added checkAlerts tests, instrumented dequeue/retry/cancel in ObservableJobQueue
8. **Backoff jitter + asPromise removal (S22, S23):** Added jitterFraction to RetryPolicy, removed asPromise wrapper from SqliteJobQueue

Also: established \*.constants.ts pattern with eslint config override, created follow-up beans for payload types (types-vnhp) and constants adoption (ps-coog).
