---
# api-icgc
title: Fix tRPC input validation gaps (message.list, note.list)
status: todo
type: bug
created_at: 2026-04-02T09:47:16Z
updated_at: 2026-04-02T09:47:16Z
---

Two tRPC list procedures are missing query filters present in REST:

- message.list: add before/after timestamp filters
- note.list: add authorEntityType, authorEntityId, systemWide filters
  See audit Domain 9.
