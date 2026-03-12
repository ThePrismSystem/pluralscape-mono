---
# db-0l3g
title: Add size constraint to sync_documents.automerge_heads
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T10:08:05Z
parent: db-2nr7
---

Binary column can grow unboundedly for long-lived documents with many peers. Add CHECK constraint or application-level limit. Ref: audit L4

## Summary of Changes\n\nAdded CHECK constraint on sync_documents.automerge_heads limiting to 16,384 bytes (PG: octet_length, SQLite: length). Created constants.ts with MAX_AUTOMERGE_HEADS_BYTES. Tests verify boundary acceptance/rejection.
