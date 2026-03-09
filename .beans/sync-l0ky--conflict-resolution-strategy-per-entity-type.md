---
# sync-l0ky
title: Conflict resolution strategy per entity type
status: todo
type: task
priority: high
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-09T12:13:02Z
parent: sync-mxeg
---

Specify conflict resolution for each entity type: fronting sessions (append-only, no conflicts), member profiles (LWW per field), notes/journal (operational transform or LWW?), chat messages (ordered log), privacy buckets (owner-wins). Document which Automerge data types map to each. Must be decided before API implementation.

Source: Architecture Audit 004, Metric 3
