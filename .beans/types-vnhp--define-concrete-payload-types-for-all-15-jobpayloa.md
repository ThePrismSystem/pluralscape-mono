---
# types-vnhp
title: Define concrete payload types for all 15 JobPayloadMap entries
status: completed
type: task
priority: normal
created_at: 2026-03-15T20:44:28Z
updated_at: 2026-03-21T12:26:00Z
parent: api-0zl4
---

All 15 entries in packages/types/src/jobs.ts JobPayloadMap are currently Record<string, unknown>. Replace with specific payload types as handlers are implemented.

## Summary of Changes\n\nTyped payloadless jobs (`blob-cleanup`, `sync-queue-cleanup`, `audit-log-cleanup`, `device-transfer-cleanup`) as `Record<string, never>`. Branded `sync-compaction` payload with `SyncDocumentId` and `SystemId`.
