---
# api-2836
title: Use assertOccUpdated in member.service.ts
status: completed
type: task
priority: low
created_at: 2026-03-18T07:12:34Z
updated_at: 2026-03-18T07:57:36Z
parent: api-i2pw
---

member.service.ts updateMember inlines OCC check instead of using shared assertOccUpdated helper. Correct but inconsistent. Ref: audit P-13.

## Summary of Changes

Replaced inline OCC check in `updateMember` with `assertOccUpdated` helper from `lib/occ-update.ts`, matching the pattern used by other services (groups, regions).
