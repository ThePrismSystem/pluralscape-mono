---
# db-0l3g
title: Add size constraint to sync_documents.automerge_heads
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T04:47:32Z
parent: db-2je4
---

Binary column can grow unboundedly for long-lived documents with many peers. Add CHECK constraint or application-level limit. Ref: audit L4
