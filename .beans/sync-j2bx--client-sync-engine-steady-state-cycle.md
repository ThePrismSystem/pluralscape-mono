---
# sync-j2bx
title: "Client sync engine: steady-state cycle"
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T01:46:27Z
parent: sync-qxxo
---

Implement steady-state sync: local change → SubmitChangeRequest → ChangeAccepted → update local seq; receive DocumentUpdate → applyEncryptedChanges → update lastSyncedSeq.

## Acceptance Criteria

- Local change submitted to relay, ChangeAccepted updates local seq tracking
- Incoming DocumentUpdate applied to local Automerge doc
- Two concurrent clients converge after both make offline edits
- Idempotent replay: re-applying same change is a no-op
- lastSyncedSeq updated only after successful apply
- Integration test: two clients, interleaved edits, verify convergence

## Summary of Changes

- Added applyLocalChange() for outbound flow: session.change() → network submit → local persist
- Added handleIncomingChanges() for inbound flow: session.applyEncryptedChanges() → local persist
- Both update lastSyncedSeq tracking
- 7 steady-state tests with real sodium for encrypt/decrypt roundtrips
