---
# types-rwnq
title: System structure and relationship types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:20Z
updated_at: 2026-03-08T13:36:09Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Relationship graph, Subsystem nesting, SideSystem, Layer, architecture and discovery types

System structure types for relationships, subsystems, side systems, and layers.

## Scope

- `Relationship`: id, systemId, sourceMemberId, targetMemberId, type (RelationshipType), bidirectional (boolean), label (custom string for custom type)
- `RelationshipType`: 'split-from' | 'fused-from' | 'sibling' | 'partner' | 'parent-child' | 'protector-of' | 'caretaker-of' | 'gatekeeper-of' | 'source' | 'custom'
- `Subsystem`: id (SubsystemId), systemId, parentSubsystemId (nullable — recursive), name, description, architectureType, originType, hasCoreFlag, discoveryStatus
- `ArchitectureType`: 'orbital' | 'compartmentalized' | 'webbed' | 'mixed'
- `DiscoveryStatus`: 'fully-mapped' | 'partially-mapped' | 'still-discovering'
- `SideSystem`: id, systemId, name, description — parallel group, not nested
- `Layer`: id, systemId, sortOrder, name, accessType ('open' | 'gatekept'), gatekeeperMemberId (nullable)
- `SubsystemMembership`: subsystemId, memberId
- No hard depth limit for nesting (polyfragmented support)

## Acceptance Criteria

- [ ] Relationship type covers all 10 edge types from features.md
- [ ] Bidirectional flag per relationship
- [ ] Subsystem supports recursive nesting (no depth limit)
- [ ] Architecture type enum with 4 values
- [ ] SideSystem as parallel (not nested) container
- [ ] Layer with optional gatekeeper assignment
- [ ] Discovery status tracking
- [ ] Unit tests for relationship graph traversal helpers

## References

- features.md section 6 (System Structure)
- ps-qvj0 (system structure research task)
