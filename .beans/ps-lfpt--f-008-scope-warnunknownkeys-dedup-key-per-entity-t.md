---
# ps-lfpt
title: "F-008: Scope warnUnknownKeys dedup key per entity type"
status: todo
type: bug
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-10T21:05:42Z
parent: ps-n0tq
---

helpers.ts:18 uses unknown-field:${key} as global dedup key. Two entity types with same unknown field name emit only one warning. Fix: unknown-field:${entityType}:${key}.
