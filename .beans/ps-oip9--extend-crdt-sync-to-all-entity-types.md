---
# ps-oip9
title: Extend CRDT sync to all entity types
status: completed
type: epic
priority: normal
created_at: 2026-04-05T05:51:16Z
updated_at: 2026-04-05T16:04:11Z
parent: ps-7j8n
---

Extend the sync engine's CRDT document coverage beyond the current 7 document types to handle all entity types. Builds on the local data layer infrastructure from ps-vegi.

## Summary of Changes

Registered materializers for note and bucket document types, completing CRDT coverage for all 7 sync document types. Added tests verifying materializer registration, DDL generation, and document materialization for the new types.
