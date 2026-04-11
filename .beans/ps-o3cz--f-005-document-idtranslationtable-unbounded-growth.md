---
# ps-o3cz
title: "F-005: Document IdTranslationTable unbounded growth"
status: completed
type: task
priority: high
created_at: 2026-04-10T21:05:28Z
updated_at: 2026-04-11T21:31:35Z
parent: ps-n0tq
---

MappingContext IdTranslationTable grows one entry per imported entity with no cap. Acceptable for personal systems but needs documentation. File: context.ts:63.

## Summary of Changes

Added explicit unbounded-growth documentation to `createMappingContext` in `context.ts`: the IdTranslationTable grows one entry per successfully-mapped entity (keyed by entityType + source ID) with no eviction, because later mappers must resolve FKs against earlier passes. Practical bound is the document count in the export (~100 bytes/entry, <1 MB for personal systems). Contrasted with the warnings buffer which is bounded via `MAX_WARNING_BUFFER_SIZE`.
