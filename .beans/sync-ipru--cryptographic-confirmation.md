---
# sync-ipru
title: Cryptographic confirmation
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:24:43Z
parent: sync-hji0
---

Do not mark syncedAt until ChangeAccepted received with server-assigned seq. Handle connection drop between submit and ack.

## Acceptance Criteria

- syncedAt remains null until ChangeAccepted message received for that change
- Connection drop between submit and ack → change re-submitted on reconnect
- Server dedup prevents double-apply of re-submitted changes
- ChangeAccepted with unexpected seq → error logged, change not marked synced
- Unit tests for each scenario: normal ack, drop-before-ack, duplicate submit

## Summary of Changes

Implemented as part of feat/sync-conflict-resolution-and-offline-queue branch.
