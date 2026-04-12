---
# ps-gff5
title: "F-011: Mobile persister granularity review"
status: completed
type: task
priority: low
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:32:04Z
parent: ps-n0tq
---

17 persister files — one per entity type. Structure matches PersistableEntity union 1:1. No change needed.

## Summary of Changes

Enriched the header comment on `apps/mobile/src/features/import-sp/persister/persister-dispatch.ts` to explain that the one-file-per-entity-variant structure is deliberate: each persister owns a distinct SQL upsert / conflict policy and is exercised independently in tests, so merging into a single dispatch file would bundle unrelated responsibilities and make per-entity edits noisy. Audit (2026-04-10) explicitly confirmed no consolidation is warranted. No functional change.
