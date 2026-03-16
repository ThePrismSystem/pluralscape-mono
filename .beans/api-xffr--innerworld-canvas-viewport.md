---
# api-xffr
title: Innerworld canvas viewport
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-16T11:58:21Z
parent: api-utms
blocked_by:
  - api-o89k
  - api-wq3i
---

GET /systems/:systemId/innerworld/canvas. PUT update (viewportX/Y, zoom, dimensions) with OCC. Singleton per system (PK systemId). Upsert on first write.
