---
# sync-aefn
title: Strongly type SyncEngine session map (remove unknown)
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:44:15Z
parent: sync-me6c
---

Finding [T-1] from audit 2026-04-20. packages/sync/src/engine/sync-engine.ts:72. sessions Map<SyncDocumentId, EncryptedSyncSession<unknown>>; getSession<T>() is caller-asserted cast. Root cause of all as DocRecord casts in post-merge-validator.ts. Introduce AnyDocumentSession union; narrow via parseDocumentId.

## Summary of Changes

Introduced AnyDocumentSession discriminated union and DocumentTypeMap in
packages/sync/src/engine/session-types.ts. SyncEngine.sessions now stores
AnyDocumentSession keyed by SyncDocumentId. Added:

- getSession(docId): AnyDocumentSession | undefined
- getTypedSession(docId, documentType): typed session narrowed in one call
- applyLocalChange overload with documentType discriminant (sync-orkv is
  delivered alongside this bean)

post-merge-validator still uses EncryptedSyncSession<unknown> with
localised `as DocRecord` casts — this is the intentional design for
validators that iterate ENTITY_FIELD_MAP across every document type.
Engine-facing consumers now see the narrowed union without casts.
