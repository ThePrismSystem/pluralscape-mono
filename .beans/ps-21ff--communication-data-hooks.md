---
# ps-21ff
title: Communication data hooks
status: completed
type: epic
priority: normal
created_at: 2026-03-31T23:12:46Z
updated_at: 2026-04-03T20:37:35Z
parent: ps-7j8n
---

Chat channels/messages, board messages, private notes, polls, acknowledgements

## Transport

All hooks use tRPC via trpc.channel.\*, trpc.message.\*, trpc.boardMessage.\*, trpc.note.\*, trpc.poll.\*, trpc.acknowledgement.\*.

## Summary of Changes\n\nAll 6 communication entity data hooks implemented: crypto transforms, React Query + tRPC hooks, and tRPC-native SSE subscriptions for 4 real-time entities.
