---
# ps-mxvp
title: Valkey pub/sub messages lack authentication/integrity
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T07:55:18Z
parent: ps-i3xl
---

Internal network, document trust boundary

## Summary of Changes\n\nExtended module-level JSDoc on valkey-pubsub.ts to document that pub/sub messages are trusted internal network traffic with no per-message authentication layer.
