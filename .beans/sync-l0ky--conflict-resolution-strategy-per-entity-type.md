---
# sync-l0ky
title: Conflict resolution strategy per entity type
status: completed
type: task
priority: high
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-14T22:50:26Z
parent: sync-mxeg
---

Specify conflict resolution for each entity type: fronting sessions (append-only, no conflicts), member profiles (LWW per field), notes/journal (operational transform or LWW?), chat messages (ordered log), privacy buckets (owner-wins). Document which Automerge data types map to each. Must be decided before API implementation.

Source: Architecture Audit 004, Metric 3

## Summary of Changes

Documented CRDT strategies for all entity types in conflict-resolution.md.
Implemented ENTITY_CRDT_STRATEGIES registry. 10-test conflict resolution
suite verifying concurrent edit semantics through full encrypted pipeline.
