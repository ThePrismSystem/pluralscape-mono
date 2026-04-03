---
# client-ensq
title: Pass timestamp query param on message single-entity API calls
status: completed
type: task
priority: normal
created_at: 2026-03-25T07:10:44Z
updated_at: 2026-04-03T20:37:35Z
parent: ps-21ff
---

Client-side work to populate the optional timestamp input field when calling tRPC message procedures (get, update, delete, archive, restore), enabling efficient partition pruning on the server.

## Summary of Changes\n\nTimestamp query param forwarded in useMessage hook for partition pruning.
