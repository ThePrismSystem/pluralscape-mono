---
# ps-62kh
title: "Clean dead code: session-refresh, biometric-key-store, friend-indexer, i18n exports"
status: todo
type: task
priority: low
created_at: 2026-04-06T00:53:47Z
updated_at: 2026-04-06T00:53:47Z
parent: ps-y621
---

Currently dead/unused exports:

1. apps/mobile/src/auth/session-refresh-service.ts — getSessionTimeouts and SessionTimeouts exported but never imported externally
2. apps/mobile/src/auth/biometric-key-store.ts — only consumed by own test, no external consumers
3. apps/mobile/src/data/index.ts — createFriendIndexer and FriendIndexerConfig re-exported with zero external consumers
4. apps/mobile/src/i18n/index.ts — createLazyBackend, LazyBackendConfig, resolveNomenclatureFromSettings, NomenclatureConfig re-exported with zero consumers
5. apps/api-e2e/src/fixtures/trpc.fixture.ts — duplicates MAX_URL_LENGTH and MAX_BATCH_ITEMS instead of importing from @pluralscape/api-client/trpc

Note: some may be pre-wired infrastructure for M9. Verify before removing.

Audit ref: Pass 6 MEDIUM
