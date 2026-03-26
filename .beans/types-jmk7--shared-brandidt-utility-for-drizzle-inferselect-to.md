---
# types-jmk7
title: Shared brandId<T> utility for Drizzle inferSelect to branded ID casts
status: draft
type: task
priority: deferred
created_at: 2026-03-26T12:23:26Z
updated_at: 2026-03-26T12:23:26Z
---

Extract a reusable brandId<T> helper to replace ~76 'row.id as XxxId' type assertions across 7 M5 services. Compile-time only benefit. Deferred from M5 audit (L7).
