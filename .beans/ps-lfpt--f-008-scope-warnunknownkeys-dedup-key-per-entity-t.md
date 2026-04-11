---
# ps-lfpt
title: "F-008: Scope warnUnknownKeys dedup key per entity type"
status: completed
type: bug
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:31:50Z
parent: ps-n0tq
---

helpers.ts:18 uses unknown-field:${key} as global dedup key. Two entity types with same unknown field name emit only one warning. Fix: unknown-field:${entityType}:${key}.

## Summary of Changes

Scoped the unknown-field dedup key in `warnUnknownKeys` to include `entityType`: `unknown-field:${entityType}:${key}` instead of `unknown-field:${key}`. This ensures two entity types with the same unknown field name (e.g., `frame` on both `member` and `custom-front`) each emit their own warning instead of the second one being silently suppressed. Added a regression test that exercises the pre-fix collision case.
