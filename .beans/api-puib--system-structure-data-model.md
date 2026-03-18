---
# api-puib
title: Structure entities and memberships
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-18T05:35:25Z
parent: ps-rdqo
---

Subsystems CRUD (recursive nesting, architecture types, has-core, discovery status), side systems CRUD, layers CRUD (open vs gatekept, gatekeeper members). Membership junctions: subsystem-memberships, side-system-memberships, layer-memberships. Cross-structure links: subsystem-layer, subsystem-side-system, side-system-layer. Archival/restore for all structure entities.

### Deletion pattern

- DELETE subsystem returns 409 HAS_DEPENDENTS if subsystem has child subsystems, memberships, or cross-structure links
- DELETE side system returns 409 HAS_DEPENDENTS if it has memberships or cross-structure links
- DELETE layer returns 409 HAS_DEPENDENTS if it has memberships or cross-structure links
- DELETE membership/link junctions are always allowed (leaf entities)
- Archival/restore as documented
