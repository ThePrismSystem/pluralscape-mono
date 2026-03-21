---
# ps-w2ww
title: PR 226 review fixes
status: completed
type: task
priority: normal
created_at: 2026-03-21T06:10:16Z
updated_at: 2026-03-21T06:14:45Z
---

Fix all critical, important, and suggestion-level issues from PR 226 review: async close rejection, dispose/close overlap, non-retriable errors, causal skip logging, post-replay race, test strengthening

## Summary of Changes

- **Critical**: Fixed async close() rejection swallowing in SyncEngine.dispose() — now catches Promise rejections via .catch() instead of discarding with void
- **Important**: Removed dispose?() from SyncNetworkAdapter interface, unified to close?() as sole lifecycle method; renamed WsNetworkAdapter.dispose() to close()
- **Important**: Added non-retriable error detection in replayEntry — 4xx errors (except 408/429) fail immediately without retries
- **Important**: Added causal skip cascade logging — onError now reports skipped entries with document/entry context
- **Important**: Fixed post-replay session hydration race — routed through enqueueDocumentOperation to serialize with concurrent pushes
- **Important**: Strengthened mixed success/failure test — uses different documentIds, asserts specific error messages and aggregate summary
- **Important**: Fixed conflict persistence failure test — stubs runAllValidations to reliably trigger saveConflicts, asserts onError
- **Important**: Added afterEach(vi.restoreAllMocks) to runtime-hardening tests
- **Suggestion**: Added async close rejection test, drainUnsynced throwing test, applyLocalChange network failure test
- **Suggestion**: Added P-M6/P-M7 skip explanation comments
- **Suggestion**: Renamed dispose references in WsNetworkAdapter tests to match close()
