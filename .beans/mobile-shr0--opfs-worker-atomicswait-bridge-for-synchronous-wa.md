---
# mobile-shr0
title: OPFS Web Worker driver with async SqliteStatement contract
status: completed
type: feature
priority: normal
created_at: 2026-04-16T16:21:59Z
updated_at: 2026-04-16T22:28:39Z
parent: ps-0enb
blocking:
  - ps-0azs
---

Move wa-sqlite + OPFSCoopSyncVFS into a dedicated Web Worker and refactor the SqliteStatement contract to be uniformly async across all driver implementations. This makes parameterized reads and writes return correct results (as Promises) without running wa-sqlite on the main thread, and without requiring SharedArrayBuffer or cross-origin isolation.

## Background

PR #459 implemented parameterized writes via the wa-sqlite prepare/bind/step API but discovered that .all() and .get() with params cannot return rows synchronously because step() is async. The PR ships parameterized writes only; .all()/.get() with params throw an explicit error pointing at this bean.

The bean's original architecture sketch (main thread blocking on Atomics.wait over a SharedArrayBuffer) is not legal per spec — Atomics.wait throws TypeError on the browser main thread because the main agent's [[CanBlock]] is false. Brainstorming (2026-04-16) evaluated three alternatives and chose the single-worker approach documented below.

## Architecture (chosen: single Web Worker, async SqliteStatement)

- One new Web Worker hosts wa-sqlite + OPFSCoopSyncVFS + the database handle + prepared-statement registry.
- Main-thread createOpfsSqliteDriver becomes a thin async proxy over postMessage. Every prepare/run/all/get/exec/transaction/close is a request/response pair with a client-generated id.
- Wire format is structured-clone (no JSON, no binary protocol, no SharedArrayBuffer). Uint8Array blobs ride through structured clone natively.
- SqliteStatement.run/.all/.get change to return Promise<...> across all driver implementations. bun-sqlite, better-sqlite3, expo-sqlite wrap their sync calls with Promise.resolve.
- SqliteDriver.transaction<T>(fn: () => Promise<T>): Promise<T> — fn is async.
- SqliteStorageAdapter and SqliteOfflineQueueAdapter already present async publicly; they switch Promise.resolve(rows.map(...)) patterns to await internally. Add static async create(driver) factories for their schema-creation exec calls.
- SyncProvider on main updates to await SqliteStorageAdapter.create(driver). All sync engine / crypto / WebSocket wiring stays on main.

## What this deliberately does not do

- No SharedArrayBuffer, no Atomics.wait, no cross-origin isolation (COOP/COEP). Not needed under this architecture.
- No hoisting of SyncEngine / adapters / crypto / WebSocket into a worker. Future upgrade to that (architecture A) tracked in ps-pn2y.
- No main-thread wa-sqlite. Rejected to avoid papercuts from WASM VM CPU between asyncify yields.
- No quota-exhaustion UX. SQLITE_FULL surfaces as typed OpfsDriverError; UX + recovery deferred to ps-gexi.
- No E2E directory rename. New Playwright suite lands as apps/mobile-web-e2e/ following the existing <app>-e2e convention; broader rename tracked in ps-vwn0.

## Constraints

- Metro (Expo Web bundler) must emit module-worker chunks cleanly for `new Worker(new URL("./opfs-worker.ts", import.meta.url), { type: "module" })`. Verified at the start of implementation.
- expo-sqlite's async API (runAsync, getAllAsync, getFirstAsync) must match the async SqliteStatement contract; adapter contract tests enforce this.
- FinalizationRegistry is non-deterministic; worker-side statement registry caps handles and LRU-evicts on overflow.

## Acceptance

- Parameterized .all() and .get() return correct rows (as Promises) via the worker bridge.
- Existing no-params and parameterized-write paths pass through the same async contract.
- Adapter contract tests in packages/sync (storage-adapter.contract.ts, offline-queue-adapter.contract.ts) pass against the async interface.
- Playwright E2E in apps/mobile-web-e2e/ passes round-trip, parameterized-reads, persistence-across-reload, concurrency, large-blob, and fallback scenarios.
- ps-0azs is marked completed once this lands.

## Design doc

Full design (architecture tradeoffs, wire protocol, module structure, migration order, risks) is in docs/superpowers/specs/2026-04-16-mobile-shr0-opfs-worker-design.md (local-only per project convention).

## Related beans

- ps-0azs — parameterized-query bean unblocked by this.
- ps-pn2y — future evaluation of upgrading to architecture (A) two-worker full hoist.
- ps-vwn0 — broader E2E directory rename.
- ps-gexi — OPFS quota-exhaustion UX + recovery.

## Summary of Changes

Phase 1 (PR #460):

- Changed SqliteStatement.run/.all/.get and SqliteDriver.transaction to async across all driver implementations.
- Added SqliteStorageAdapter.create() and SqliteOfflineQueueAdapter.create() factories.
- SyncProvider.tsx awaits the new factory.

Phase 2 (this PR):

- Wrote opfs-worker.ts hosting wa-sqlite + OPFSCoopSyncVFS in a dedicated Web Worker.
- Rewrote opfs-sqlite-driver.ts as a thin main-thread proxy over postMessage.
- Added @journeyapps/wa-sqlite@^1.6.0 dep; removed obsolete ambient declarations from types/global.d.ts in favor of the package's real SQLiteAPI/SQLiteVFS/SQLiteCompatibleType.
- Worker registers a prepared-statement registry with MAX_STMT_HANDLES=128 LRU eviction (with sqlite3.finalize on evict and on close).
- Driver proxy serializes transactions via a promise-chain mutex; on worker error sets terminated=true so subsequent calls reject synchronously instead of hanging; clears request timeout timers on success.
- Updated detect.ts to gracefully fall back to IndexedDB when OPFS worker init fails, recording the reason in capabilities.storageFallbackReason.
- Added apps/mobile-web-e2e/ Playwright suite with esbuild-based harness (round-trip, persistence, concurrency, large-blob, fallback) — 5/5 passing.
- Worker unit tests: 19 covering init/dispatch/prepare/run/all/get/finalize/close/LRU/blob/postMessage fallback/exhaustive default.
- Driver proxy unit tests: 11 covering init/prepare+run/all/transaction serialization/error rejection/worker-terminated synchronous reject/init timeout/init failure terminate/get/rollback identity.
- CI: pnpm test:e2e:web runs in the existing E2E job.
- No SharedArrayBuffer, no cross-origin isolation required.
- Unblocks ps-0azs (completed alongside).
