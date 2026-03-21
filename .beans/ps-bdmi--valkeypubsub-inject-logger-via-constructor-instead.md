---
# ps-bdmi
title: "ValkeyPubSub: inject logger via constructor instead of module import"
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:08:32Z
parent: ps-i3xl
---

valkey-pubsub.ts:11

## Summary of Changes\n\nChanged ValkeyPubSub constructor to accept a PubSubLogger parameter instead of importing the module-level logger singleton. Updated call site in index.ts and test mock.
