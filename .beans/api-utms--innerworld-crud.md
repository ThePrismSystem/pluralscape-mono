---
# api-utms
title: Innerworld CRUD
status: completed
type: epic
priority: normal
created_at: 2026-03-16T11:33:07Z
updated_at: 2026-03-18T05:35:25Z
parent: ps-rdqo
blocked_by:
    - api-o89k
    - api-puib
    - api-wq3i
---

CRUD for innerworld regions (recursive hierarchy, boundary polygon data, gatekeeper assignments, visual properties), innerworld entities (5-type discriminated union: member, landmark, subsystem, side-system, layer -- each with spatial positioning and visual properties), and innerworld canvas viewport state. Archival/restore for regions and entities.

### Deletion pattern

- DELETE region returns 409 HAS_DEPENDENTS if region has child regions or innerworld entities
- DELETE entity is always allowed (no dependents point to entities)
- Archival/restore for regions and entities as documented
