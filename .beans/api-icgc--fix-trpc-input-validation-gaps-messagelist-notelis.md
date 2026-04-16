---
# api-icgc
title: Fix tRPC input validation gaps (message.list, note.list)
status: completed
type: bug
priority: normal
created_at: 2026-04-02T09:47:16Z
updated_at: 2026-04-16T07:29:50Z
parent: ps-n8uk
---

Two tRPC list procedures are missing query filters present in REST:

- message.list: add before/after timestamp filters
- note.list: add authorEntityType, authorEntityId, systemWide filters
  See audit Domain 9.

## Summary of Changes\n\nAdded before/after filters to message.list and authorEntityType/authorEntityId/systemWide filters to note.list
