---
# api-4ydu
title: Fix N+1 reorder queries in group and member-photo services
status: completed
type: task
priority: high
created_at: 2026-04-14T09:29:09Z
updated_at: 2026-04-16T06:35:33Z
parent: ps-ai5y
---

AUDIT [API-P-H1] reorderGroups issues N individual UPDATEs via Promise.all. Same codebase has correct CASE/WHEN batch pattern in board-message.service.ts:430. Also affects reorderMemberPhotos. File: apps/api/src/services/group.service.ts:482

## Summary of Changes

Replaced N+1 UPDATE queries with single CASE/WHEN batch in reorderGroups and reorderMemberPhotos.
