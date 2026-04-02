---
# api-gey8
title: Add missing tRPC delete procedures (8 routers)
status: todo
type: task
created_at: 2026-04-02T09:47:09Z
updated_at: 2026-04-02T09:47:09Z
---

Add permanent delete procedures missing from 8 tRPC routers:

- snapshot.delete (deleteSnapshot)
- structure.deleteType, structure.deleteEntity
- frontingComment.delete
- frontingReport.delete
- timerConfig.delete
- message.delete
- innerworld.deleteRegion, innerworld.deleteEntity
  All use systemProcedure. See audit Domains 3, 6, 8, 9, 12.
