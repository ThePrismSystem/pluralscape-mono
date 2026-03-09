---
# sync-2xog
title: Document topology design
status: completed
type: task
priority: critical
created_at: 2026-03-08T13:34:47Z
updated_at: 2026-03-09T03:33:12Z
parent: sync-xlhb
blocking:
  - sync-pl87
  - sync-mgcd
  - sync-t1rl
  - sync-jr85
---

Design document: which domain entities map to which Automerge CRDT documents. Output is a specification, not code.

## Scope

- Evaluate document granularity options:
  1. One doc per system (simple but large)
  2. One doc per collection type (members doc, fronting doc, chat doc per channel)
  3. One doc per entity (granular, many docs, high sync overhead)
  4. Hybrid: one doc per "unit of collaboration" (recommended by research)
- Recommended approach: group by access pattern and encryption key boundary
  - System core doc: members, groups, structure, settings (encrypted with master key)
  - Per-channel chat doc: messages for one channel (encrypted with master key)
  - Fronting doc: fronting sessions, switches (encrypted with master key)
  - Per-bucket docs: bucket-scoped data (encrypted with bucket key — maps to secsync pattern)
- Document size projections for typical and polyfragmented systems
- Output: topology specification with rationale

## Acceptance Criteria

- [x] Document topology specified with entity-to-document mapping
- [x] Size projections for small (10 members), medium (50), large (500+) systems
- [x] Encryption key boundaries align with document boundaries
- [x] Partial replication strategy follows from topology
- [x] Written as specification document in packages/sync/docs/
- [x] Review: topology supports all M1 entity types

## Research Notes

- Automerge 3.0 cut memory 10x, making larger docs viable
- Use encryption-key boundaries as document boundaries (secsync pattern)
- Per-entity creates too much sync overhead; per-collection forces loading everything

## References

- ADR 005 (Offline-First Sync)

## Summary of Changes

Created `packages/sync/docs/document-topology.md` — a comprehensive specification covering 6 document types (system-core, fronting, chat, journal, privacy-config, bucket), complete entity-to-document mapping for all 48 entity types in ids.ts, size projections at three system scales, time-based splitting strategy, manifest-based document discovery, partial replication profiles, and downstream task interface documentation.
