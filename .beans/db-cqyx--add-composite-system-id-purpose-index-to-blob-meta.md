---
# db-cqyx
title: Add composite (system_id, purpose) index to blob_metadata
status: todo
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

Queries filtering by purpose (e.g. list all avatar blobs for system) need this composite. Currently only system_id indexed. Ref: audit L8
