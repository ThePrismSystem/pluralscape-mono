---
# sync-y3ps
title: CRDT document topology design
status: completed
type: task
priority: high
created_at: 2026-03-09T12:13:01Z
updated_at: 2026-03-14T22:50:26Z
parent: sync-mxeg
---

Define the Automerge document structure: one document per entity vs per-collection vs per-system. Map each entity type to its CRDT semantics (fronting: append-only, member profiles: LWW-per-field, chat: ordered log). Document in ADR 005 addendum or new ADR.

Source: Architecture Audit 004, Metric 3 & Fix This Now #1

## Summary of Changes

Defined typed Automerge document interfaces for all 6 sync document types.
Key decisions: ImmutableString for all string fields (LWW), junction maps as
Record<string, true>, topology corrections for CheckInRecord and BoardMessage
(append-lww maps, not append-only lists). 25-test schema suite.
