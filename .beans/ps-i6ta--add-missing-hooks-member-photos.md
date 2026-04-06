---
# ps-i6ta
title: "Add missing hooks: member photos"
status: completed
type: task
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T02:44:11Z
parent: ps-y621
---

Zero hook coverage for member photos. Create hooks wrapping memberPhotoRouter for multi-photo gallery (day-one feature): upload, get, list, delete, reorder.

Audit ref: Pass 1 CRITICAL

## Summary of Changes\n\nAdded 7 member photo hooks with tests. Scoped by memberId.
