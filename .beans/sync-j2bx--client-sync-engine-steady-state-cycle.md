---
# sync-j2bx
title: "Client sync engine: steady-state cycle"
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
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
