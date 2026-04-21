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

applyLocalChange has a single, strongly-typed signature:

- `applyLocalChange<T extends SyncDocumentType>(docId, documentType, changeFn)`:
  changeFn receives `DocumentTypeMap[T]`. Engine asserts that
  `parseDocumentId(docId).documentType === documentType` AND the stored
  session's documentType matches, throwing `NoActiveSessionError` otherwise.

Pre-release posture (CLAUDE.md): the earlier `applyLocalChange(docId, changeFn)`
back-compat overload was removed outright — no deprecated shim retained.
The three internal sync-package tests that exercised the 2-arg form
(`sync-engine-steady-state`, `sync-engine-runtime-hardening`,
`sync-engine-edge-cases`) were migrated to the typed 3-arg form. No
external consumers existed, so no downstream packages or apps required
changes.

Callers can no longer accidentally mutate the wrong document shape: the
document-type literal is required at the call site and the closure is
typed against the matching `DocumentTypeMap` entry.
