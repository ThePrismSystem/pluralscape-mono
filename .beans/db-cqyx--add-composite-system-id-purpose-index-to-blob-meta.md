---
# db-cqyx
title: Add composite (system_id, purpose) index to blob_metadata
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

Queries filtering by purpose (e.g. list all avatar blobs for system) need this composite. Currently only system_id indexed. Ref: audit L8

## Summary of Changes\n\nReplaced `blob_metadata_system_id_idx` with composite `blob_metadata_system_id_purpose_idx`.
