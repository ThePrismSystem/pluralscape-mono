---
# sync-aefn
title: Strongly type SyncEngine session map (remove unknown)
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [T-1] from audit 2026-04-20. packages/sync/src/engine/sync-engine.ts:72. sessions Map<SyncDocumentId, EncryptedSyncSession<unknown>>; getSession<T>() is caller-asserted cast. Root cause of all as DocRecord casts in post-merge-validator.ts. Introduce AnyDocumentSession union; narrow via parseDocumentId.
