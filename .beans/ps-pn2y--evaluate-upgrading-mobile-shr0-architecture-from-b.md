---
# ps-pn2y
title: Evaluate upgrading mobile-shr0 architecture from (B) single worker to (A) two-worker full hoist
status: todo
type: task
priority: deferred
created_at: 2026-04-16T18:09:12Z
updated_at: 2026-04-16T18:18:26Z
parent: ps-9u4w
---

Re-evaluate whether the web sync stack should move from architecture (B) — single worker hosting wa-sqlite + OPFS, sync engine on main thread — to architecture (A) — two workers, with the entire sync pipeline (engine, adapters, key resolver, crypto, WebSocket) hoisted into Worker A and a SAB+Atomics bridge to a Worker B that hosts wa-sqlite + OPFS.

This bean exists because mobile-shr0 deliberately picked (B) over (A) on UX-per-cost grounds, and (A) is the natural future upgrade if real-world UX measurements show (B)'s residual main-thread work is causing a noticeable papercut.

## Background — what was decided in mobile-shr0

During brainstorming for mobile-shr0 we evaluated three architectures:

- **(A) Two workers**: Worker A hosts SyncEngine + SqliteStorageAdapter + SqliteOfflineQueueAdapter + DocumentKeyResolver + BucketKeyCache + WasmSodiumAdapter (libsodium duplicated) + WsManager (WebSocket in worker); Worker B hosts wa-sqlite + OPFSCoopSyncVFS; Worker A blocks on Atomics.wait over a SharedArrayBuffer for sync-feeling DB calls; main thread (React) talks to Worker A via async postMessage RPC. SyncProvider becomes a thin async-RPC facade.
- **(B) Single worker (chosen)**: wa-sqlite + OPFSCoopSyncVFS in a worker; main-side createOpfsSqliteDriver is an async proxy over postMessage; SqliteStatement contract returns Promises; sync engine, adapters, key resolver, crypto, WebSocket all stay on main thread.
- **(C) No worker**: wa-sqlite runs on main thread; SqliteStatement returns Promises; everything else unchanged. Rejected because wa-sqlite VM CPU between asyncify yields would cause papercuts during scrolling and gestures.

(B) was chosen because it captures the largest UX win (DB I/O + SQL VM CPU off main) at moderate cost, without inheriting the permanent operational tax of cross-origin isolation (COOP/COEP). (A) buys an additional UX win (sync engine + crypto CPU off main) at substantially higher cost, with benefits visible mainly at bootstrap and during heavy write bursts.

## Why (A) might be worth the upgrade later

Residual main-thread work in (B) that (A) would eliminate:

- **Sync engine CPU** — CRDT merge, document materialization, projection updates. ~1–5ms per sync event in steady state; can accumulate to 100–500ms during bootstrap or large incoming pushes.
- **Crypto CPU** — XChaCha20-Poly1305 decryption, ed25519 signature verification, libsodium init. ~0.1–1ms per envelope; adds up at bootstrap.
- **WebSocket frame handling** — protocol parsing, message dispatch. Negligible per frame but co-located on main with React.

The user-visible scenarios where (A) > (B):

1. **Bootstrap on a device with significant data** (returning user, fresh device, post-cache-clear). (B) may stutter intermittently as the sync engine merges hundreds-to-thousands of incoming changes. (A) keeps the UI perfectly smooth while a progress bar fills.
2. **Heavy authoring under sync pressure** — rapid local edits while a remote push is being processed. (B) bursts ~5–15ms of main thread; could cause animation hitches during fronting-switch transitions or gesture-driven UI.
3. **Live fronting with many co-fronters and rapid switches** — main thread doing presentation + animation + sync engine concurrently.

## Cost of upgrading (B) → (A)

Engineering:

- Hoist SyncEngine, SqliteStorageAdapter, SqliteOfflineQueueAdapter, DocumentKeyResolver, BucketKeyCache into Worker A. All public APIs become async-RPC across the worker boundary.
- Duplicate WasmSodiumAdapter inside Worker A — libsodium WASM (~300 KB) loaded twice (main + Worker A); transfer key material across the boundary safely (key material should only ever live in Worker A after init).
- Move WsManager (WebSocket) into Worker A so the network adapter is colocated with the sync engine.
- Rewrite SyncProvider as a thin async-RPC facade. Existing useSync consumers may need to switch from sync engine method calls to RPC-mediated equivalents.
- Re-introduce wa-sqlite + SAB + Atomics.wait bridge between Worker A and Worker B (skipped in B). Binary wire protocol; growable SAB; overflow handling.
- Duplicate event-bus delivery semantics across the worker boundary (events emitted in Worker A must reach React subscribers on main).

Operational / deployment:

- Cross-Origin Isolation (COOP: same-origin, COEP: require-corp) required on every served resource in dev and prod. Subresources missing CORP break the page. Constrains iframe embedding. Adds CDN config, dev-server config, and an ongoing operational concern (any third-party asset must send compatible headers).
- Cold start +200–500ms (two WASM loads, libsodium init in worker, key material handshake).
- Memory +20–40 MB for duplicated worker-side state.

Debugging / DX:

- Three contexts (main, Worker A, Worker B) instead of two. DevTools can handle it but mental overhead is real.

## Decision criteria — when to upgrade

Upgrade when at least one of:

1. Real-user metrics show p95 main-thread long tasks (>50ms) attributable to sync engine or crypto are happening during normal navigation at a rate that user research correlates with reported jank.
2. Bootstrap time on a representative "large system" account (e.g. SP import of a 5000-doc system) shows visible UI freeze for >500ms during merge.
3. We add a feature that puts heavy main-thread work alongside sync engine activity (e.g. real-time collaborative editing with concurrent CRDT merges and animations) and instrumentation shows main-thread saturation.

Do not upgrade when:

- Steady-state metrics show <16ms main-thread long tasks attributable to sync work.
- Bootstrap stutters but is gated by a progress UI users accept.
- COOP/COEP would break a current or planned integration (third-party embed, OAuth popup, certain analytics SDKs that don't ship CORP).

## Acceptance

- Real-user main-thread long-task instrumentation in place for a representative window (target: ≥2 weeks of M11 dogfooding once UI is built).
- Bootstrap perf measurement on a representative large-system test fixture.
- Decision documented in an ADR: either (a) commit to upgrading and create implementation beans, or (b) decline with measured rationale and revisit triggers.

## Pointers (to keep context recoverable after time passes)

- mobile-shr0 — the original feature bean and brainstorming context.
- ps-0azs — the parameterized-query bean unblocked by mobile-shr0.
- apps/mobile/src/platform/drivers/opfs-sqlite-driver.ts — the OPFS driver mobile-shr0 will rewrite.
- apps/mobile/src/sync/SyncProvider.tsx — current sync-engine wiring that (A) would refactor into an async-RPC facade.
- packages/sync/src/adapters/sqlite-storage-adapter.ts — already-async adapter that made (B) viable; contract that (A) preserves.
- docs/adr/031-web-storage-backend.md — existing ADR on the web storage backend choice.

## Note on COOP/COEP (added after initial creation)

COOP/COEP cross-origin isolation headers were originally in scope for mobile-shr0 (see that bean's Q1) but were dropped when (B) was chosen, since (B) does not use SharedArrayBuffer. This bean explicitly owns the deployment plumbing: if upgrading to (A), dev server + prod CDN header configuration is part of the implementation cost (already listed under "Operational / deployment" above). Do not ship COOP/COEP pre-emptively — it carries a permanent operational tax (breaks iframe embeds, constrains OAuth popups, requires every third-party asset to send compatible CORP) with zero benefit under (B).
