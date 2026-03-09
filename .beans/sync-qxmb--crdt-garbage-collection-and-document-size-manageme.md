---
# sync-qxmb
title: CRDT garbage collection and document size management
status: todo
type: task
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-09T12:13:02Z
parent: sync-mxeg
---

Design garbage collection strategy for Automerge documents. Define: when history is compacted, maximum document size before splitting, how to handle long-lived documents (e.g., chat channels with thousands of messages). ADR 005 acknowledges this need but provides no design.

Source: Architecture Audit 004, Metric 4
