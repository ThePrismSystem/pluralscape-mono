---
# sync-orkv
title: Type applyLocalChange with document-specific generic
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:45:21Z
parent: sync-me6c
---

Finding [T-2] from audit 2026-04-20. packages/sync/src/engine/sync-engine.ts:251. changeFn typed (doc: unknown)=>void; callers can mutate wrong document type without type error. Fix: <T>(docId, changeFn: (doc: T) => void) paired with T-1.

## Summary of Changes

applyLocalChange now supports two overloads:

- `applyLocalChange(docId, documentType, changeFn)`: narrow variant where
  changeFn receives DocumentTypeMap[T]. Engine asserts that
  parseDocumentId(docId).documentType === documentType AND the stored
  session's documentType matches, throwing NoActiveSessionError otherwise.
- `applyLocalChange(docId, changeFn)`: legacy variant with Record<string,
  unknown> changeFn. Still works for dynamic access code paths.

Callers can no longer accidentally mutate the wrong document shape when
they opt into the typed overload.
