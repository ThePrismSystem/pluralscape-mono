---
# api-gey8
title: Add missing tRPC delete procedures (8 routers)
status: completed
type: task
priority: normal
created_at: 2026-04-02T09:47:09Z
updated_at: 2026-04-02T10:56:43Z
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

## Summary of Changes\n\nAdded delete procedures to snapshot, structure (2), fronting-comment, fronting-report, timer-config, message, and innerworld (2) routers
