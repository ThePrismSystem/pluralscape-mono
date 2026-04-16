---
# ps-3a7l
title: "Fix PR #215 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-21T01:03:18Z
updated_at: 2026-04-16T07:29:46Z
parent: ps-afy4
---

Fix all important issues and implement all suggestions from PR #215 review: dispatchWithAccess refactor, dedup error type, disposed guard, SyncTransport onClose, error class improvements, and test coverage gaps

## Summary of Changes

- Refactored `dispatchWithAccess` with generic context parameter `C` to eliminate `undefined as never` closure pattern
- Moved `onSuccess` callback outside the handler try/catch into its own try/catch (log-only) to prevent double-response
- Used `messageType` in error messages (`Failed to process ${messageType}`) instead of generic string
- Fixed wrong error type on dedup fallback in sync-relay.service.ts (was DocumentNotFoundError, now assertion Error)
- Added disposed guard on `request()` in ws-network-adapter.ts
- Added `onClose?` to SyncTransport interface, removed duck-typed check
- Added `readonly operation` field to UnsupportedDocumentTypeError
- Typed SyncTimeoutError.messageType as `ClientMessage["type"]` instead of string
- Added submitSnapshot tests (SyncProtocolError, VERSION_CONFLICT, UnexpectedResponseError, SnapshotAccepted)
- Updated string-based assertions to instanceof checks (AdapterDisposedError, SyncProtocolError, SyncTimeoutError)
- Added disposed guard test, onSuccess exception safety test, dedup fallback test, operation field test
- All 5240 tests pass, zero lint warnings, typecheck clean
