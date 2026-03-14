---
# sync-y3ps
title: CRDT document topology design
status: in-progress
type: task
priority: high
created_at: 2026-03-09T12:13:01Z
updated_at: 2026-03-14T22:18:04Z
parent: sync-mxeg
---

Define the Automerge document structure: one document per entity vs per-collection vs per-system. Map each entity type to its CRDT semantics (fronting: append-only, member profiles: LWW-per-field, chat: ordered log). Document in ADR 005 addendum or new ADR.

Source: Architecture Audit 004, Metric 3 & Fix This Now #1
