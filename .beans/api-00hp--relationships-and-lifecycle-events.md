---
# api-00hp
title: Relationships and lifecycle events
status: completed
type: epic
priority: normal
created_at: 2026-03-16T11:33:12Z
updated_at: 2026-03-18T05:35:25Z
parent: ps-rdqo
blocked_by:
  - api-o89k
  - api-b0nb
  - api-wq3i
---

Member-to-member relationships: typed directed edges (split-from, fused-from, sibling, partner, parent-child, protector-of, caretaker-of, gatekeeper-of, source, custom), bidirectional flag, user-defined labels for custom types. Archival/restore. Lifecycle events: append-only immutable log (split, fusion, merge/unmerge, dormancy start/end, discovery, archival, subsystem formation, form change, name change, structure move, innerworld move). Each event references involved and resulting members.

### Deletion pattern

- DELETE relationship is always allowed (relationships are leaf entities with no dependents)
- Lifecycle events are append-only immutable — no deletion endpoint
