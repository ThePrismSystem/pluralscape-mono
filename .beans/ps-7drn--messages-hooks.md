---
# ps-7drn
title: Messages hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:54Z
updated_at: 2026-04-03T20:37:35Z
parent: ps-21ff
---

Send, list (paginated), edit, delete, real-time append

Uses trpc.message.\* (send, list, get, update, delete). Real-time append via SSE notification client (REST).

## Summary of Changes\n\nMessage data hooks with crypto transforms, query/mutation hooks, and real-time subscription. Includes timestamp partition pruning (client-ensq).
