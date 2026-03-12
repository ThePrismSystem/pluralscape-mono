---
# db-0xcq
title: Add composite (system_id, archived) index to members
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

Separate archived and system_id indexes force bitmap AND for common get active members query. Ref: audit L3

## Summary of Changes\n\nConsolidated `members_system_id_idx` + `members_archived_idx` into single composite `members_system_id_archived_idx`.
