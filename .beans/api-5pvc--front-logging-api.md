---
# api-5pvc
title: Front logging API
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-22T11:48:12Z
parent: ps-mmpz
---

Start/end sessions, co-fronting as parallel timelines, structure entity fronting, retroactive edits, comments, custom front status text, active fronting queries

### Deletion pattern

Custom fronts: API returns 409 HAS_DEPENDENTS if fronting sessions reference them. Sessions: API returns 409 HAS_DEPENDENTS if comments exist. Switches/comments: leaf entities, always deletable. Archival always allowed regardless of dependents.
