---
# sync-5gdu
title: Introduce branded protocol IDs
status: completed
type: task
priority: deferred
created_at: 2026-03-15T02:14:32Z
updated_at: 2026-03-21T12:26:00Z
parent: api-0zl4
---

Replace raw string IDs (docId, systemId, etc.) with branded/opaque types across sync protocol interfaces. Deferred from PR #112 review — touches too many interfaces and needs its own design decision.

## Summary of Changes\n\nReplaced all `docId: string` with `SyncDocumentId` and `systemId: string` with `SystemId` across 15+ protocol interfaces. Updated Zod schemas in `message-schemas.ts` with `.transform()` to produce branded types at the validation boundary. Fixed downstream in sync engine, ws-network-adapter, handlers, and all test files.
