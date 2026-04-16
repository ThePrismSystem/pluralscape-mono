---
# types-jmk7
title: Shared brandId<T> utility for Drizzle inferSelect to branded ID casts
status: todo
type: task
priority: normal
created_at: 2026-03-26T12:23:26Z
updated_at: 2026-04-16T06:49:51Z
parent: ps-0enb
---

Extract a reusable brandId<T> helper to replace ~76 'row.id as XxxId' type assertions across 7 M5 services. Compile-time only benefit. Deferred from M5 audit (L7).
