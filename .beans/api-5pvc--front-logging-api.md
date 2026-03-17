---
# api-5pvc
title: Front logging API
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-17T03:26:02Z
parent: ps-mmpz
---

Start/end/switch, co-fronting vs co-conscious, subsystem-level fronting, retroactive edits, comments, custom front status text

### Deletion pattern

Custom fronts: API returns 409 HAS_DEPENDENTS if fronting sessions reference them. Sessions: API returns 409 HAS_DEPENDENTS if comments exist. Switches/comments: leaf entities, always deletable. Archival always allowed regardless of dependents.
