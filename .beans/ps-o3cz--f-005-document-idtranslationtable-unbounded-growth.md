---
# ps-o3cz
title: "F-005: Document IdTranslationTable unbounded growth"
status: todo
type: task
priority: high
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-10T21:05:28Z
parent: ps-n0tq
---

MappingContext IdTranslationTable grows one entry per imported entity with no cap. Acceptable for personal systems but needs documentation. File: context.ts:63.
