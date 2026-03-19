---
# sync-p7ey
title: Sync schema audit and migration
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-qxxo
---

Verify \`sync_documents\`/\`sync_queue\` tables match the document-ID model from the protocol spec (not entity-level). Migrate if needed.

## Acceptance Criteria

- Schema supports document IDs like \`fronting-sys_abc-2026-Q1\` (time-split partitioned)
- seq is monotonic per document (not global)
- Indexes support efficient fetchChangesSince(docId, seq) queries
- Migration is backwards-compatible if sync tables already have data
- Schema parity test updated to include sync tables
