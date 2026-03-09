---
# sync-cgq1
title: Encrypted CRDT relay proof-of-concept
status: todo
type: task
priority: critical
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-09T12:15:10Z
parent: sync-mxeg
blocking:
  - ps-rdqo
---

Build a minimal PoC: two Automerge clients syncing a single encrypted Member profile through a dumb relay server. Prove: (1) Automerge sync messages work when payload is encrypted, (2) server cannot read content, (3) conflict resolution works correctly after concurrent edits. This validates the entire sync architecture before committing to it.

Source: Architecture Audit 004, Fix This Now #1
