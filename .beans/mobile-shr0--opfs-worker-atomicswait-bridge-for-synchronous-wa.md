---
# mobile-shr0
title: OPFS Worker + Atomics.wait bridge for synchronous wa-sqlite reads
status: todo
type: feature
priority: normal
created_at: 2026-04-16T16:21:59Z
updated_at: 2026-04-16T16:21:59Z
parent: ps-0enb
blocking:
  - ps-0azs
---

Implement a Web Worker that hosts wa-sqlite, with the main thread blocking on Atomics.wait over a SharedArrayBuffer for the duration of each query. Required to make parameterized .all() and .get() return correct rows synchronously, satisfying the SqliteStatement interface contract.

## Background

PR #459 (feat/m9-opfs-parameterized-queries) implemented parameterized writes via the wa-sqlite prepare/bind/step API but discovered that .all() and .get() with params cannot return rows synchronously because step() is async. The PR ships parameterized writes only; .all()/.get() with params throw an explicit error pointing at this bean.

## Architecture sketch (to be designed)

- Dedicated Web Worker hosts wa-sqlite + OPFSCoopSyncVFS
- Main thread sends query message, blocks on Atomics.wait over a SharedArrayBuffer
- Worker writes result count + serialized rows into the SAB, then signals via Atomics.notify
- Main thread reads rows from the SAB, returns synchronously to the caller

## Constraints

- Requires Cross-Origin Isolation (COOP: same-origin, COEP: require-corp) for SharedArrayBuffer
- Affects deployment headers across web hosts (Expo Web, dev server, prod CDN)
- vitest's jsdom environment has no Worker; need a worker shim or alternate test strategy (jsdom + happy-dom + msw worker mock, or skip-with-fallback)
- Error marshaling across the worker boundary needs structured serialization

## Acceptance

- Parameterized .all() and .get() return correct rows synchronously
- Existing no-params and parameterized-write paths unchanged
- Integration tests in packages/sync exercise the OPFS driver against SqliteStorageAdapter and SqliteOfflineQueueAdapter
- ps-0azs can be marked completed once this lands
